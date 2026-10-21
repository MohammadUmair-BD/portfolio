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

type Ctx = RouteContext<"/api/admin/[resource]">;

function guard(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  if (!hasDatabase()) return Response.json({ error: "No database yet. Set DATABASE_URL (see README)." }, { status: 503 });
  return null;
}

export async function GET(request: Request, ctx: Ctx) {
  const denied = guard(request);
  if (denied) return denied;
  const { resource } = await ctx.params;
  if (resource === "unanswered") return Response.json(await listUnanswered());
  if (resource === "answers") return Response.json(await getCustomAnswers());
  if (resource === "messages") return Response.json(await listContactMessages());
  return Response.json({ error: "Not found" }, { status: 404 });
}

export async function POST(request: Request, ctx: Ctx) {
  const denied = guard(request);
  if (denied) return denied;
  const { resource } = await ctx.params;
  if (resource !== "answers") return Response.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => null);
  const keywords = String(body?.keywords ?? "").trim();
  const answer = String(body?.answer ?? "").trim();
  if (!keywords || !answer || keywords.length > 300 || answer.length > 1000) {
    return Response.json({ error: "Keywords and answer are required (max 300 / 1000 characters)." }, { status: 422 });
  }
  await addCustomAnswer(keywords, answer);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const denied = guard(request);
  if (denied) return denied;
  const { resource } = await ctx.params;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return Response.json({ error: "Missing id" }, { status: 422 });
  if (resource === "answers") await deleteCustomAnswer(id);
  else if (resource === "unanswered") await deleteUnanswered(id);
  else return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}
