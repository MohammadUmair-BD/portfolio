import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/cat/ask/route";

let ip = 0;
const post = (body: unknown, from = `10.0.0.${++ip}`) =>
  POST(new Request("http://localhost/api/cat/ask", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": from },
    body: JSON.stringify(body),
  }));

describe("POST /api/cat/ask", () => {
  it("answers a question", async () => {
    const res = await post({ question: "does he know laravel" });
    expect(res.status).toBe(200);
    expect((await res.json()).intent).toBe("skill_check");
  });

  it("rejects empty and over-long input", async () => {
    expect((await post({ question: "" })).status).toBe(422);
    expect((await post({ question: "a".repeat(301) })).status).toBe(422);
  });

  it("rate limits at 30 per minute", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 31; i++) statuses.push((await post({ question: "hi" }, "10.9.9.9")).status);
    expect(statuses.slice(0, 30).every((s) => s === 200)).toBe(true);
    expect(statuses[30]).toBe(429);
  });
});
