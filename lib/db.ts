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
