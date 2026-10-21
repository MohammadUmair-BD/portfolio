import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as ADMIN_POST, GET as ADMIN_GET } from "@/app/api/admin/[resource]/route";
import { POST as ASK } from "@/app/api/cat/ask/route";
import { POST as CONTACT } from "@/app/api/contact/route";
import { clean, containsMarkup, isSafeHref, jsonForScript } from "@/lib/security";

let ip = 0;
type Opts = { body?: string; headers?: Record<string, string> };
const req = (path: string, { body, headers = {} }: Opts = {}) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `10.1.0.${++ip}`, host: "localhost", ...headers },
    body,
  });
const contact = (fields: Record<string, unknown>, headers?: Record<string, string>) =>
  CONTACT(req("/api/contact", { body: JSON.stringify({ name: "Sara Khan", email: "sara@example.com", message: "Hello Umair, I'd like to talk about a Laravel role.", ...fields }), headers }));

const ATTACKS = [
  "<script>alert(1)</script>",
  "<img src=x onerror=alert(1)>",
  "<svg/onload=alert(1)>",
  "<iframe src=//evil.example>",
  "javascript:alert(document.cookie)",
  "JaVaScRiPt :alert(1)",
  "data:text/html;base64,PHNjcmlwdD4=",
  "&#60;script&#62;alert(1)&#60;/script&#62;",
  "%3Cscript%3Ealert(1)%3C/script%3E",
  "\\u003cscript\\u003e",
  "<!-- comment -->",
  "＜script＞alert(1)＜/script＞", // full-width brackets, normalised by NFKC
];

describe("markup detection", () => {
  it.each(ATTACKS)("flags %s", (attack) => {
    expect(containsMarkup(clean(attack, { multiline: true }))).toBe(true);
  });

  it.each([
    "Does he know Laravel?",
    "I <3 your portfolio",
    "Is 5 < 10? Yes, and a < b in plain text is fine.",
    "We use C# and C++ & PHP",
    "Email me at hr@company.com about the role",
    "Our onboarding = 2 weeks",
  ])("allows normal text: %s", (text) => {
    expect(containsMarkup(text)).toBe(false);
  });

  it("strips control and zero-width characters", () => {
    // Zero-width and direction-override characters vanish; a null byte becomes a space.
    expect(clean("La​ra\u0000vel‮")).toBe("Lara vel");
    expect(clean("line1\r\nline2\u0007", { multiline: true })).toBe("line1\nline2");
  });
});

describe("contact form", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each(ATTACKS)("rejects an injection attempt in the message: %s", async (attack) => {
    const res = await contact({ message: `Hello there ${attack} thanks` });
    expect(res.status).toBe(422);
    expect((await res.json()).errors.message).toMatch(/HTML or code/);
  });

  it("rejects markup in the name and a malformed email", async () => {
    const res = await contact({ name: "<b>Sara</b>", email: "x@y\"><script>" });
    const { errors } = await res.json();
    expect(res.status).toBe(422);
    expect(errors.name).toBeDefined();
    expect(errors.email).toBeDefined();
  });

  it("accepts a normal message (503 only because no database is configured in tests)", async () => {
    vi.stubEnv("DATABASE_URL", "");
    expect((await contact({})).status).toBe(503);
  });

  it("refuses cross-site posts", async () => {
    expect((await contact({}, { origin: "https://evil.example" })).status).toBe(403);
    expect((await contact({}, { "sec-fetch-site": "cross-site" })).status).toBe(403);
  });

  it("refuses non-JSON and oversized bodies", async () => {
    expect((await CONTACT(req("/api/contact", { body: "name=x", headers: { "content-type": "application/x-www-form-urlencoded" } }))).status).toBe(415);
    expect((await contact({ message: "a".repeat(9000) })).status).toBe(413);
    expect((await CONTACT(req("/api/contact", { body: "{not json" }))).status).toBe(400);
    expect((await CONTACT(req("/api/contact", { body: "[1,2]" }))).status).toBe(400);
  });

  it("quietly drops bot submissions (honeypot, or filled in under 2.5 s)", async () => {
    vi.stubEnv("DATABASE_URL", "");
    expect(await (await contact({ website: "spam.example" })).json()).toEqual({ ok: true });
    expect(await (await contact({ startedAt: Date.now() - 500 })).json()).toEqual({ ok: true });
  });
});

describe("chat", () => {
  it.each(ATTACKS)("rejects an injection attempt: %s", async (attack) => {
    const res = await ASK(req("/api/cat/ask", { body: JSON.stringify({ question: `does he know ${attack}` }) }));
    expect(res.status).toBe(422);
  });

  it("still answers plain questions", async () => {
    const res = await ASK(req("/api/cat/ask", { body: JSON.stringify({ question: "Does he know Laravel?" }) }));
    expect(res.status).toBe(200);
  });

  it("refuses cross-site requests", async () => {
    const res = await ASK(req("/api/cat/ask", { body: JSON.stringify({ question: "hi" }), headers: { origin: "https://evil.example" } }));
    expect(res.status).toBe(403);
  });
});

describe("admin", () => {
  afterEach(() => vi.unstubAllEnvs());
  const ctx = (resource: string) => ({ params: Promise.resolve({ resource }) });
  const admin = (password: string, from: string) =>
    ADMIN_GET(new Request("http://localhost/api/admin/answers", { headers: { authorization: `Bearer ${password}`, "x-forwarded-for": from, host: "localhost" } }), ctx("answers"));

  it("is disabled without a strong ADMIN_PASSWORD", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "short");
    expect((await admin("short", "10.2.0.1")).status).toBe(503);
  });

  it("locks an IP out after 5 wrong passwords, even if the 6th is right", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "correct horse battery staple");
    vi.stubEnv("DATABASE_URL", "");
    for (let i = 0; i < 5; i++) expect((await admin(`guess-${i}`, "10.2.0.2")).status).toBe(401);
    expect((await admin("correct horse battery staple", "10.2.0.2")).status).toBe(429);
    // A different IP with the right password is not affected (503 here = no database in tests).
    expect((await admin("correct horse battery staple", "10.2.0.3")).status).toBe(503);
  });

  it("refuses cross-site admin writes", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "correct horse battery staple");
    const res = await ADMIN_POST(
      new Request("http://localhost/api/admin/answers", {
        method: "POST",
        headers: { authorization: "Bearer correct horse battery staple", origin: "https://evil.example", host: "localhost", "content-type": "application/json" },
        body: JSON.stringify({ keywords: "x", answer: "y" }),
      }),
      ctx("answers"),
    );
    expect(res.status).toBe(403);
  });
});

describe("output helpers", () => {
  it("only allows safe link targets", () => {
    for (const ok of ["https://emkaan.com/", "mailto:a@b.co", "tel:+923", "/quick#contact"]) expect(isSafeHref(ok)).toBe(true);
    for (const bad of ["javascript:alert(1)", "//evil.example", "data:text/html,x", " vbscript:x"]) expect(isSafeHref(bad)).toBe(false);
  });

  it("JSON for inline scripts cannot close the script tag", () => {
    const out = jsonForScript({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(JSON.parse(out).name).toBe("</script><script>alert(1)</script>");
  });
});
