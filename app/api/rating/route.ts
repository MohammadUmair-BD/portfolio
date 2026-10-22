import { getSummary, isVoterId, rate } from "@/lib/ratings";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { readJson, rejectCrossSite } from "@/lib/security";

async function safely(run: () => Promise<Response>) {
  try {
    return await run();
  } catch (err) {
    console.error("rating api", err);
    return Response.json({ error: "Ratings are unavailable right now." }, { status: 500 });
  }
}

/** Public summary: average (once enough people rated), count, and this visitor's own rating. */
export async function GET(request: Request) {
  return safely(async () => {
    const voter = new URL(request.url).searchParams.get("voter");
    return Response.json(await getSummary(isVoterId(voter) ? voter : undefined));
  });
}

export async function POST(request: Request) {
  return safely(async () => {
    const crossSite = rejectCrossSite(request);
    if (crossSite) return crossSite;
    const ip = clientIp(request);
    if (!rateLimit(`rating:${ip}`, 10)) {
      return Response.json({ error: "Too many tries. Please wait a minute." }, { status: 429 });
    }
    const body = await readJson(request, 500);
    if ("error" in body) return body.error;
    const { voter, stars } = body.data;
    if (!isVoterId(voter)) return Response.json({ error: "Invalid request." }, { status: 422 });
    if (typeof stars !== "number" || !Number.isInteger(stars) || stars < 1 || stars > 5) {
      return Response.json({ error: "Please choose 1 to 5 stars." }, { status: 422 });
    }

    const result = await rate(voter, stars, ip);
    if (result.status === "unavailable") return Response.json({ error: "Ratings aren't switched on yet." }, { status: 503 });
    if (result.status === "limited") {
      return Response.json({ error: "Thanks! Several people on your network have already rated today." }, { status: 429 });
    }
    if (result.status === "cooldown") {
      const retryAfter = Math.ceil((result.lockedUntil - Date.now()) / 1000);
      return Response.json(
        { error: "You changed your rating recently. Please wait before changing it again.", lockedUntil: result.lockedUntil, retryAfter },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
    return Response.json(await getSummary(voter));
  });
}
