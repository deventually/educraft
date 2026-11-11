/**
 * Repository rule: all DB access goes through repositories; every exported function is
 * `async`. The retention of `ai_usage` (BESLUIT-2026-11-11-6): rows per person stay for the
 * thirteen months the usage page offers; older rows become month totals without a person in
 * `ai_usage_rollup` (the whole institution, and per team) and are deleted. Not user-scoped by
 * design: it is housekeeping over everyone, run by the server on a timer.
 */
import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "../db.server";
import { aiUsageRollup } from "../schema.server";

/** The thirteen months kept per person: this month and the twelve before. */
const MONTHS_KEPT = 13;

/** The first day kept per person, as a UTC "YYYY-MM-DD": the first of the oldest kept month. */
export function retentionCutoff(today: string): string {
  const [y, m] = today.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 - (MONTHS_KEPT - 1), 1)).toISOString().slice(0, 10);
}

const COUNTERS = [
  "calls",
  "failed_calls",
  "unmetered_calls",
  "input_tokens",
  "cache_read_tokens",
  "cache_write_tokens",
  "output_tokens",
  "reasoning_tokens",
  "cost_micros",
  "unpriced_calls",
] as const;

const columns = sql.raw(COUNTERS.join(", "));
const sums = sql.raw(COUNTERS.map((c) => `sum(u.${c})`).join(", "));
const adds = sql.raw(COUNTERS.map((c) => `${c} = ${c} + excluded.${c}`).join(", "));

/**
 * Move every `ai_usage` row before `cutoff` into the month totals and delete it, in one
 * transaction. Returns how many person rows went. Safe to run again: totals add up.
 */
export async function rollUpAiUsage(cutoff: string): Promise<number> {
  return getDb().transaction((tx) => {
    const insert = (team: ReturnType<typeof sql>, join: ReturnType<typeof sql>, by: string) =>
      tx.run(sql`
        INSERT INTO ai_usage_rollup (id, month, team_id, source, provider, model, ${columns})
        SELECT lower(hex(randomblob(16))), substr(u.day, 1, 7), ${team}, u.source,
               max(u.provider), u.model, ${sums}
        FROM ai_usage u ${join}
        WHERE u.day < ${cutoff}
        GROUP BY substr(u.day, 1, 7), ${sql.raw(by)} u.source, u.model
        ON CONFLICT (month, team_id, source, model) DO UPDATE SET ${adds}`);
    // The whole institution, then per team (its members today).
    insert(sql`''`, sql``, "");
    insert(sql`m.team_id`, sql`JOIN team_members m ON m.user_id = u.user_id`, "m.team_id,");
    return tx.run(sql`DELETE FROM ai_usage WHERE day < ${cutoff}`).changes;
  });
}

/** The totals of one month ("YYYY-MM"); `teamId` null is the whole institution. */
export async function listAiUsageRollup(month: string) {
  const rows = getDb()
    .select()
    .from(aiUsageRollup)
    .where(eq(aiUsageRollup.month, month))
    .orderBy(asc(aiUsageRollup.teamId), asc(aiUsageRollup.source), asc(aiUsageRollup.model))
    .limit(500)
    .all();
  return rows.map(({ id: _, teamId, ...r }) => ({ ...r, teamId: teamId === "" ? null : teamId }));
}
