import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { rejectCrossSite } from "@/lib/security";

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Wrong passwords per IP: 5 in 15 minutes locks that IP out until the window passes. */
const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 15 * 60_000;
const failures = new Map<string, number[]>();

function recentFailures(ip: string) {
  const now = Date.now();
  const list = (failures.get(ip) ?? []).filter((t) => now - t < FAILURE_WINDOW_MS);
  failures.set(ip, list);
  if (failures.size > 5000) failures.clear();
  return list;
}

/**
 * The admin page sends ADMIN_PASSWORD as a Bearer token on every request.
 * Returns an error Response, or null when the request is allowed.
 */
export function requireAdmin(request: Request): Response | null {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;

  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 12) {
    return Response.json({ error: "Admin is disabled. Set ADMIN_PASSWORD (12+ characters) in the environment." }, { status: 503 });
  }
  const ip = clientIp(request);
  if (recentFailures(ip).length >= MAX_FAILURES) {
    return Response.json({ error: "Too many wrong passwords. Try again in 15 minutes." }, { status: 429 });
  }
  if (!rateLimit(`admin:${ip}`, 30)) {
    return Response.json({ error: "Too many requests. Wait a minute." }, { status: 429 });
  }
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!timingSafeEqual(digest(given), digest(password))) {
    recentFailures(ip).push(Date.now());
    return Response.json({ error: "Wrong password." }, { status: 401 });
  }
  return null;
}
