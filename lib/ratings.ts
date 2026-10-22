import "server-only";
import { createHash } from "node:crypto";
import { findRating, hasDatabase, newVotersFromSince, ratingDistribution, saveRating } from "@/lib/db";

/** The average is only shown publicly once this many people have rated. */
export const MIN_PUBLIC_RATINGS = 3;
/** New voters allowed from one network per day (clearing the browser to vote again is capped). */
const NEW_VOTERS_PER_NETWORK_PER_DAY = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export type RatingSummary = {
  available: boolean;
  /** Average to one decimal, or null until MIN_PUBLIC_RATINGS is reached. */
  average: number | null;
  count: number;
  /** This visitor's own rating, if they have rated. */
  mine: number | null;
};

/** A random id the visitor's browser makes up and keeps; it identifies nobody. */
export const isVoterId = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

/** Salted one-way hash of the network address: lets us cap repeat voting without storing anyone's IP. */
export function hashNetwork(ip: string) {
  const salt = process.env.RATING_SALT || process.env.DATABASE_URL || "local-dev-salt";
  return createHash("sha256").update(`${salt}|${ip}`).digest("hex");
}

/**
 * Where ratings live: the real database when DATABASE_URL is set, otherwise
 * (only when not running on Vercel, i.e. local testing) a temporary in-memory
 * store that resets when the server restarts.
 */
type Store = {
  find(voter: string): Promise<number | null>;
  newVotersFrom(ipHash: string, since: Date): Promise<number>;
  save(voter: string, stars: number, ipHash: string): Promise<void>;
  distribution(): Promise<number[]>;
};

const memory = new Map<string, { stars: number; ipHash: string; createdAt: number }>();
const memoryStore: Store = {
  find: async (voter) => memory.get(voter)?.stars ?? null,
  newVotersFrom: async (ipHash, since) => [...memory.values()].filter((r) => r.ipHash === ipHash && r.createdAt > since.getTime()).length,
  save: async (voter, stars, ipHash) => {
    memory.set(voter, { stars, ipHash, createdAt: memory.get(voter)?.createdAt ?? Date.now() });
  },
  distribution: async () => {
    const dist = [0, 0, 0, 0, 0];
    for (const r of memory.values()) dist[r.stars - 1]++;
    return dist;
  },
};
const databaseStore: Store = { find: findRating, newVotersFrom: newVotersFromSince, save: saveRating, distribution: ratingDistribution };

function store(): Store | null {
  if (hasDatabase()) return databaseStore;
  return process.env.VERCEL ? null : memoryStore;
}

export async function getSummary(voter?: string): Promise<RatingSummary> {
  const s = store();
  if (!s) return { available: false, average: null, count: 0, mine: null };
  const dist = await s.distribution();
  const count = dist.reduce((a, b) => a + b, 0);
  const total = dist.reduce((sum, n, i) => sum + n * (i + 1), 0);
  return {
    available: true,
    average: count >= MIN_PUBLIC_RATINGS ? Math.round((total / count) * 10) / 10 : null,
    count,
    mine: voter ? await s.find(voter) : null,
  };
}

export async function getDistribution(): Promise<number[] | null> {
  const s = store();
  return s ? s.distribution() : null;
}

/** Saves or updates a rating. "limited" means this network already added several new voters today. */
export async function rate(voter: string, stars: number, ip: string): Promise<"ok" | "limited" | "unavailable"> {
  const s = store();
  if (!s) return "unavailable";
  const ipHash = hashNetwork(ip);
  const existing = await s.find(voter);
  if (existing === null && (await s.newVotersFrom(ipHash, new Date(Date.now() - DAY_MS))) >= NEW_VOTERS_PER_NETWORK_PER_DAY) {
    return "limited";
  }
  await s.save(voter, stars, ipHash);
  return "ok";
}

/** Test helper: empties the in-memory store. */
export function resetMemoryRatings() {
  memory.clear();
}
