/**
 * Sliding-window limiter, the equivalent of Laravel's throttle:30,1.
 * It lives in memory, so on Vercel each server instance counts separately.
 * That's enough to stop casual abuse of a free portfolio.
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, max = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return true;
}

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "local";
}
