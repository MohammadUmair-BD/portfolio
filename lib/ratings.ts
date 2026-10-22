import "server-only";
import { createHash } from "node:crypto";
import { findRating, hasDatabase, newVotersFromSince, ratingDistribution, saveRating, type StoredRating } from "@/lib/db";

/** The average is only shown publicly once this many people have rated. */
export const MIN_PUBLIC_RATINGS = 3;
/** New voters allowed from one network per day (clearing the browser to vote again is capped). */
const NEW_VOTERS_PER_NETWORK_PER_DAY = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_S = 365 * 24 * 60 * 60;

/**
 * How long a visitor must wait before changing their rating again, after their
 * Nth confirmed rating: 60 s, 5 min, 30 min, 60 min, 6 h, 2.5 days, then 5× longer
 * each time, capped at one year.
 */
const COOLDOWN_STEPS_S = [60, 5 * 60, 30 * 60, 60 * 60, 360 * 60, 3600 * 60];
export function cooldownSeconds(confirmedRatings: number): number {
  const i = Math.max(1, confirmedRatings) - 1;
  if (i < COOLDOWN_STEPS_S.length) return COOLDOWN_STEPS_S[i];
  const last = COOLDOWN_STEPS_S.at(-1)!;
  return Math.min(YEAR_S, last * 5 ** (i - COOLDOWN_STEPS_S.length + 1));
}

export type RatingSummary = {
  available: boolean;
  /** Average to one decimal, or null until MIN_PUBLIC_RATINGS is reached. */
  average: number | null;
  count: number;
  /** This visitor's own rating, if they have rated. */
  mine: number | null;
  /** When this visitor may change their rating again (epoch ms), if they're in a cooldown. */
  lockedUntil: number | null;
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
  find(voter: string): Promise<StoredRating | null>;
  newVotersFrom(ipHash: string, since: Date): Promise<number>;
  save(voter: string, stars: number, ipHash: string, changes: number, lockedUntil: number): Promise<void>;
  distribution(): Promise<number[]>;
};

const memory = new Map<string, StoredRating & { ipHash: string; createdAt: number }>();
const memoryStore: Store = {
  find: async (voter) => {
    const r = memory.get(voter);
    return r ? { stars: r.stars, changes: r.changes, lockedUntil: r.lockedUntil } : null;
  },
  newVotersFrom: async (ipHash, since) => [...memory.values()].filter((r) => r.ipHash === ipHash && r.createdAt > since.getTime()).length,
  save: async (voter, stars, ipHash, changes, lockedUntil) => {
    memory.set(voter, { stars, ipHash, changes, lockedUntil, createdAt: memory.get(voter)?.createdAt ?? Date.now() });
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

/** Requests from this computer (local testing): many browsers share one address, so the per-network cap is skipped. */
const isLocalAddress = (ip: string) => ["local", "127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(ip);

const activeLock = (r: StoredRating | null) => (r?.lockedUntil && r.lockedUntil > Date.now() ? r.lockedUntil : null);

export async function getSummary(voter?: string): Promise<RatingSummary> {
  const s = store();
  if (!s) return { available: false, average: null, count: 0, mine: null, lockedUntil: null };
  const dist = await s.distribution();
  const count = dist.reduce((a, b) => a + b, 0);
  const total = dist.reduce((sum, n, i) => sum + n * (i + 1), 0);
  const own = voter ? await s.find(voter) : null;
  return {
    available: true,
    average: count >= MIN_PUBLIC_RATINGS ? Math.round((total / count) * 10) / 10 : null,
    count,
    mine: own?.stars ?? null,
    lockedUntil: activeLock(own),
  };
}

export async function getDistribution(): Promise<number[] | null> {
  const s = store();
  return s ? s.distribution() : null;
}

export type RateResult =
  | { status: "ok" }
  | { status: "cooldown"; lockedUntil: number }
  | { status: "limited" }
  | { status: "unavailable" };

/**
 * Saves a confirmed rating. Each confirmed change starts a longer cooldown
 * (see cooldownSeconds). Re-confirming the same stars changes nothing.
 */
export async function rate(voter: string, stars: number, ip: string): Promise<RateResult> {
  const s = store();
  if (!s) return { status: "unavailable" };
  const existing = await s.find(voter);
  const lock = activeLock(existing);
  if (lock) return { status: "cooldown", lockedUntil: lock };
  if (existing?.stars === stars) return { status: "ok" };

  const ipHash = hashNetwork(ip);
  if (!existing && !isLocalAddress(ip) && (await s.newVotersFrom(ipHash, new Date(Date.now() - DAY_MS))) >= NEW_VOTERS_PER_NETWORK_PER_DAY) {
    return { status: "limited" };
  }
  const changes = (existing?.changes ?? 0) + 1;
  await s.save(voter, stars, ipHash, changes, Date.now() + cooldownSeconds(changes) * 1000);
  return { status: "ok" };
}

/** Test helper: empties the in-memory store. */
export function resetMemoryRatings() {
  memory.clear();
}
