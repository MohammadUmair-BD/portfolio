import { hasDatabase, saveContactMessage } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { clean, containsMarkup, readJson, rejectCrossSite } from "@/lib/security";

const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const NAME = /^[\p{L}\p{M}][\p{L}\p{M} .'’-]{1,99}$/u;
const MIN_FILL_MS = 2500; // people take longer than this to fill the form; bots don't

export async function POST(request: Request) {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  if (!rateLimit(`contact:${clientIp(request)}`, 5)) {
    return Response.json({ error: "Too many messages. Please try again in a minute." }, { status: 429 });
  }

  const body = await readJson(request, 8_000);
  if ("error" in body) return body.error;
  const { data } = body;

  // Bot traps: the hidden "website" field, or a form submitted inhumanly fast.
  // Pretend it worked so bots don't learn anything.
  const startedAt = Number(data.startedAt);
  if (data.website || (startedAt && Date.now() - startedAt < MIN_FILL_MS)) return Response.json({ ok: true });

  const name = clean(data.name);
  const email = clean(data.email).toLowerCase();
  const message = clean(data.message, { multiline: true });

  const errors: Record<string, string> = {};
  if (!NAME.test(name)) errors.name = "Please enter your name (letters only).";
  if (email.length > 200 || !EMAIL.test(email)) errors.email = "Please enter a valid email.";
  if (message.length < 10 || message.length > 3000) errors.message = "Message should be 10 to 3000 characters.";
  else if (containsMarkup(message)) errors.message = "Please remove any HTML or code from your message.";
  if (Object.keys(errors).length) return Response.json({ errors }, { status: 422 });

  if (!hasDatabase()) {
    return Response.json({ error: "The contact form isn't connected yet. Please use email instead." }, { status: 503 });
  }
  try {
    await saveContactMessage(name, email, message);
  } catch (err) {
    console.error("contact: save failed", err);
    return Response.json({ error: "Couldn't send right now. Please use email instead." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
