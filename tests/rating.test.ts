import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/rating/route";
import { hashNetwork, resetMemoryRatings } from "@/lib/ratings";

// No DATABASE_URL and not on Vercel in tests, so ratings use the in-memory store.
let n = 0;
const voter = () => `${(++n).toString(16).padStart(8, "0")}-0000-4000-8000-000000000000`;
const vote = (v: string, stars: unknown, ip = "10.3.0.1", headers: Record<string, string> = {}) =>
  POST(new Request("http://localhost/api/rating", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip, host: "localhost", ...headers },
    body: JSON.stringify({ voter: v, stars }),
  }));
const summary = async (v?: string) => (await GET(new Request(`http://localhost/api/rating${v ? `?voter=${v}` : ""}`))).json();

describe("ratings", () => {
  beforeEach(() => resetMemoryRatings());

  it("hides the average until 3 people have rated, then shows it with the count", async () => {
    expect(await summary()).toMatchObject({ available: true, average: null, count: 0 });
    await vote(voter(), 5, "10.3.1.1");
    await vote(voter(), 4, "10.3.1.2");
    expect(await summary()).toMatchObject({ average: null, count: 2 });
    await vote(voter(), 3, "10.3.1.3");
    expect(await summary()).toMatchObject({ average: 4, count: 3 });
  });

  it("lets a visitor change their rating without counting twice", async () => {
    const me = voter();
    await vote(me, 2, "10.3.2.1");
    const res = await vote(me, 5, "10.3.2.1");
    expect(await res.json()).toMatchObject({ count: 1, mine: 5 });
  });

  it("returns the visitor's own rating", async () => {
    const me = voter();
    await vote(me, 4, "10.3.3.1");
    expect((await summary(me)).mine).toBe(4);
    expect((await summary(voter())).mine).toBeNull();
  });

  it("caps new voters from one network per day (clearing the browser to vote again)", async () => {
    for (let i = 0; i < 3; i++) expect((await vote(voter(), 5, "10.3.4.1")).status).toBe(200);
    expect((await vote(voter(), 5, "10.3.4.1")).status).toBe(429);
    expect((await vote(voter(), 5, "10.3.4.2")).status).toBe(200); // a different network is fine
  });

  it.each([0, 6, 3.5, "5", null, "<script>"])("rejects invalid stars: %s", async (stars) => {
    expect((await vote(voter(), stars, "10.3.5.1")).status).toBe(422);
  });

  it("rejects made-up voter ids and cross-site posts", async () => {
    expect((await vote("not-a-uuid", 5, "10.3.6.1")).status).toBe(422);
    expect((await vote("<script>alert(1)</script>", 5, "10.3.6.2")).status).toBe(422);
    expect((await vote(voter(), 5, "10.3.6.3", { origin: "https://evil.example" })).status).toBe(403);
  });

  it("never stores the raw IP address", () => {
    const h = hashNetwork("203.0.113.7");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain("203.0.113.7");
  });
});
