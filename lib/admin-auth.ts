import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const digest = (s: string) => createHash("sha256").update(s).digest();

/**
 * The admin page sends ADMIN_PASSWORD as a Bearer token on every request.
 * Returns an error Response, or null when the request is allowed.
 */
export function requireAdmin(request: Request): Response | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 12) {
    return Response.json({ error: "Admin is disabled. Set ADMIN_PASSWORD (12+ characters) in the environment." }, { status: 503 });
  }
  if (!rateLimit(`admin:${clientIp(request)}`, 20)) {
    return Response.json({ error: "Too many attempts. Wait a minute." }, { status: 429 });
  }
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!timingSafeEqual(digest(given), digest(password))) {
    return Response.json({ error: "Wrong password." }, { status: 401 });
  }
  return null;
}
