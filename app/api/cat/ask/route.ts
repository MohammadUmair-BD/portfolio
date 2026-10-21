import { catResponder } from "@/lib/cat";
import { getCustomAnswers, logUnanswered } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const MAX_LENGTH = 300;

export async function POST(request: Request) {
  if (!rateLimit(`cat:${clientIp(request)}`)) {
    return Response.json({ error: "Too many questions. Give me a minute to catch my breath. 🐾" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question) return Response.json({ error: "Ask me something first." }, { status: 422 });
  if (question.length > MAX_LENGTH) {
    return Response.json({ error: `Please keep questions under ${MAX_LENGTH} characters.` }, { status: 422 });
  }

  // Database trouble must never break the chat itself.
  const custom = await getCustomAnswers().catch((err) => (console.error("custom answers", err), []));
  const reply = catResponder.respond(question, custom);
  if (!reply.answered) await logUnanswered(question).catch((err) => console.error("log unanswered", err));

  return Response.json(reply);
}
