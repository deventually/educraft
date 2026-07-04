/**
 * Repository rule (Phase 1): all DB access goes through repositories; every
 * exported signature is `async` and returns a Promise; no better-sqlite3 API is
 * used outside `db.server.ts`; every query is scoped to its owning `userId`.
 *
 * Backs the per-user daily quota (audit finding #8). One `usage` row per
 * (userId, day); `day` is a UTC date string so a rollover lands on a fresh row.
 */
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db.server";
import { usage } from "../schema.server";
import { env } from "../env.server";

/** Today's date as a UTC "YYYY-MM-DD" string — the quota bucket key. */
export function utcDay(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export interface DailyUsage {
  userId: string;
  day: string;
  requests: number;
  outputChars: number;
  outputTokens: number | null;
}

const zero = (userId: string, day: string): DailyUsage => ({
  userId,
  day,
  requests: 0,
  outputChars: 0,
  outputTokens: null,
});

/** The user's counters for `day` (defaults to today), or zeros if untouched. */
export async function getTodayUsage(userId: string, day = utcDay()): Promise<DailyUsage> {
  const row = getDb()
    .select()
    .from(usage)
    .where(and(eq(usage.userId, userId), eq(usage.day, day)))
    .get();
  if (!row) return zero(userId, day);
  return {
    userId: row.userId,
    day: row.day,
    requests: row.requests,
    outputChars: row.outputChars,
    outputTokens: row.outputTokens ?? null,
  };
}

export interface RecordUsageInput {
  chars: number;
  /** Optional; accumulated only once the adapter surfaces token usage. */
  tokens?: number;
}

/** Increment the user's counters for `day` (upsert): +1 request, +chars, +tokens. */
export async function recordUsage(
  userId: string,
  input: RecordUsageInput,
  day = utcDay(),
): Promise<void> {
  const db = getDb();
  const existing = db
    .select()
    .from(usage)
    .where(and(eq(usage.userId, userId), eq(usage.day, day)))
    .get();

  if (existing) {
    const nextTokens =
      input.tokens === undefined
        ? existing.outputTokens
        : (existing.outputTokens ?? 0) + input.tokens;
    db.update(usage)
      .set({
        requests: existing.requests + 1,
        outputChars: existing.outputChars + input.chars,
        outputTokens: nextTokens,
      })
      .where(and(eq(usage.userId, userId), eq(usage.day, day)))
      .run();
  } else {
    db.insert(usage)
      .values({
        id: randomUUID(),
        userId,
        day,
        requests: 1,
        outputChars: input.chars,
        outputTokens: input.tokens ?? null,
      })
      .run();
  }
}

/**
 * Whether the user may run another generation on `day`. Blocks once the request
 * count reaches `DAILY_REQUEST_LIMIT`, or (only when token data exists) once
 * `outputTokens` reaches `DAILY_OUTPUT_TOKEN_LIMIT`. Admin exemption is applied
 * by the caller (the stream route), not here.
 */
export async function checkQuota(userId: string, day = utcDay()): Promise<{ ok: boolean }> {
  const u = await getTodayUsage(userId, day);
  if (u.requests >= env.DAILY_REQUEST_LIMIT) return { ok: false };
  if (u.outputTokens !== null && u.outputTokens >= env.DAILY_OUTPUT_TOKEN_LIMIT) {
    return { ok: false };
  }
  return { ok: true };
}

/** Remove all usage rows for a user (delete-my-data cascade). */
export async function deleteUsageForUser(userId: string): Promise<void> {
  getDb().delete(usage).where(eq(usage.userId, userId)).run();
}
