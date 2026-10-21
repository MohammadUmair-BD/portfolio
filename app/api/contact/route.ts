import { hasDatabase, saveContactMessage } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  if (!rateLimit(`contact:${clientIp(request)}`, 5)) {
    return Response.json({ error: "Too many messages. Please try again in a minute." }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  // Bots fill every field, including the hidden "website" one.
  if (body?.website) return Response.json({ ok: true });

  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim();
  const message = String(body?.message ?? "").trim();
  const errors: Record<string, string> = {};
  if (name.length < 2 || name.length > 100) errors.name = "Please enter your name.";
  if (!EMAIL.test(email) || email.length > 200) errors.email = "Please enter a valid email.";
  if (message.length < 10 || message.length > 3000) errors.message = "Message should be 10 to 3000 characters.";
  if (Object.keys(errors).length) return Response.json({ errors }, { status: 422 });

  if (!hasDatabase()) {
    return Response.json({ error: "The contact form isn't connected yet. Please use email instead." }, { status: 503 });
  }
  await saveContactMessage(name, email, message);
  return Response.json({ ok: true });
}
