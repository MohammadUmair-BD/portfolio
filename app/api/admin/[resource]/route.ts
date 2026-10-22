import { requireAdmin } from "@/lib/admin-auth";
import {
  addCustomAnswer,
  deleteCustomAnswer,
  deleteUnanswered,
  getCustomAnswers,
  hasDatabase,
  listContactMessages,
  listUnanswered,
} from "@/lib/db";
import { getDistribution } from "@/lib/ratings";
import { clean, containsMarkup, readJson } from "@/lib/security";

type Ctx = RouteContext<"/api/admin/[resource]">;

/** Database errors become a generic 500; details go to the server log only. */
async function safely(run: () => Promise<Response>) {
  try {
    return await run();
  } catch (err) {
    console.error("admin api", err);
    return Response.json({ error: "Something went wrong. Check the server logs." }, { status: 500 });
  }
}

function guard(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  if (!hasDatabase()) return Response.json({ error: "No database yet. Set DATABASE_URL (see README)." }, { status: 503 });
  return null;
}

export async function GET(request: Request, ctx: Ctx) {
  return safely(() => get(request, ctx));
}

async function get(request: Request, ctx: Ctx) {
  const denied = guard(request);
  if (denied) return denied;
  const { resource } = await ctx.params;
  if (resource === "unanswered") return Response.json(await listUnanswered());
  if (resource === "answers") return Response.json(await getCustomAnswers());
  if (resource === "messages") return Response.json(await listContactMessages());
  if (resource === "ratings") return Response.json(await getDistribution());
  return Response.json({ error: "Not found" }, { status: 404 });
}

export async function POST(request: Request, ctx: Ctx) {
  return safely(() => post(request, ctx));
}

async function post(request: Request, ctx: Ctx) {
  const denied = guard(request);
  if (denied) return denied;
  const { resource } = await ctx.params;
  if (resource !== "answers") return Response.json({ error: "Not found" }, { status: 404 });
  const body = await readJson(request, 4_000);
  if ("error" in body) return body.error;
  const keywords = clean(body.data.keywords);
  const answer = clean(body.data.answer, { multiline: true });
  if (!keywords || !answer || keywords.length > 300 || answer.length > 1000) {
    return Response.json({ error: "Keywords and answer are required (max 300 / 1000 characters)." }, { status: 422 });
  }
  if (containsMarkup(keywords) || containsMarkup(answer)) {
    return Response.json({ error: "Answers are shown as plain text. Please remove any HTML or code." }, { status: 422 });
  }
  await addCustomAnswer(keywords, answer);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request, ctx: Ctx) {
  return safely(() => remove(request, ctx));
}

async function remove(request: Request, ctx: Ctx) {
  const denied = guard(request);
  if (denied) return denied;
  const { resource } = await ctx.params;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0) return Response.json({ error: "Missing id" }, { status: 422 });
  if (resource === "answers") await deleteCustomAnswer(id);
  else if (resource === "unanswered") await deleteUnanswered(id);
  else return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}
