import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { CustomAnswer } from "@/lib/cat/types";

/**
 * Free Neon Postgres, connected through DATABASE_URL. The site still works
 * without it: the chat answers normally, it just can't log misses, load custom
 * answers, or store contact messages.
 */
let client: NeonQueryFunction<false, false> | null = null;
let schemaReady: Promise<unknown> | null = null;

export const hasDatabase = () => Boolean(process.env.DATABASE_URL);

async function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  client ??= neon(process.env.DATABASE_URL);
  const sql = client;
  schemaReady ??= Promise.all([
    sql`CREATE TABLE IF NOT EXISTS unanswered_questions (id SERIAL PRIMARY KEY, question TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    sql`CREATE TABLE IF NOT EXISTS custom_answers (id SERIAL PRIMARY KEY, keywords TEXT NOT NULL, answer TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    sql`CREATE TABLE IF NOT EXISTS contact_messages (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, message TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    // One row per visitor (an anonymous random id from their browser). ip_hash is a salted one-way hash, only used to limit repeat voting.
    // changes = confirmed ratings so far (drives the growing cooldown); locked_until = when they may change it again.
    sql`CREATE TABLE IF NOT EXISTS ratings (voter TEXT PRIMARY KEY, stars SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5), ip_hash TEXT NOT NULL, changes INT NOT NULL DEFAULT 1, locked_until TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  ]).catch((err) => {
    schemaReady = null;
    throw err;
  });
  await schemaReady;
  return sql;
}

export async function logUnanswered(question: string) {
  if (!hasDatabase()) return;
  const sql = await db();
  await sql`INSERT INTO unanswered_questions (question) VALUES (${question})`;
}

export async function listUnanswered() {
  const sql = await db();
  return sql`SELECT id, question, created_at FROM unanswered_questions ORDER BY created_at DESC LIMIT 200`;
}

export async function deleteUnanswered(id: number) {
  const sql = await db();
  await sql`DELETE FROM unanswered_questions WHERE id = ${id}`;
}

export async function getCustomAnswers(): Promise<CustomAnswer[]> {
  if (!hasDatabase()) return [];
  const sql = await db();
  return (await sql`SELECT id, keywords, answer FROM custom_answers ORDER BY id`) as CustomAnswer[];
}

export async function addCustomAnswer(keywords: string, answer: string) {
  const sql = await db();
  await sql`INSERT INTO custom_answers (keywords, answer) VALUES (${keywords}, ${answer})`;
}

export async function deleteCustomAnswer(id: number) {
  const sql = await db();
  await sql`DELETE FROM custom_answers WHERE id = ${id}`;
}

export async function saveContactMessage(name: string, email: string, message: string) {
  const sql = await db();
  await sql`INSERT INTO contact_messages (name, email, message) VALUES (${name}, ${email}, ${message})`;
}

export async function listContactMessages() {
  const sql = await db();
  return sql`SELECT id, name, email, message, created_at FROM contact_messages ORDER BY created_at DESC LIMIT 200`;
}

export type StoredRating = { stars: number; changes: number; lockedUntil: number | null };

export async function findRating(voter: string): Promise<StoredRating | null> {
  const sql = await db();
  const rows = (await sql`SELECT stars, changes, locked_until FROM ratings WHERE voter = ${voter}`) as { stars: number; changes: number; locked_until: string | Date | null }[];
  const r = rows[0];
  return r ? { stars: r.stars, changes: r.changes, lockedUntil: r.locked_until ? new Date(r.locked_until).getTime() : null } : null;
}

export async function newVotersFromSince(ipHash: string, since: Date): Promise<number> {
  const sql = await db();
  const rows = (await sql`SELECT count(*)::int AS n FROM ratings WHERE ip_hash = ${ipHash} AND created_at > ${since.toISOString()}`) as { n: number }[];
  return rows[0]?.n ?? 0;
}

export async function saveRating(voter: string, stars: number, ipHash: string, changes: number, lockedUntil: number) {
  const sql = await db();
  const until = new Date(lockedUntil).toISOString();
  await sql`INSERT INTO ratings (voter, stars, ip_hash, changes, locked_until) VALUES (${voter}, ${stars}, ${ipHash}, ${changes}, ${until})
    ON CONFLICT (voter) DO UPDATE SET stars = EXCLUDED.stars, changes = EXCLUDED.changes, locked_until = EXCLUDED.locked_until, updated_at = now()`;
}

export async function ratingDistribution(): Promise<number[]> {
  const sql = await db();
  const rows = (await sql`SELECT stars, count(*)::int AS n FROM ratings GROUP BY stars`) as { stars: number; n: number }[];
  const dist = [0, 0, 0, 0, 0];
  for (const r of rows) dist[r.stars - 1] = r.n;
  return dist;
}
