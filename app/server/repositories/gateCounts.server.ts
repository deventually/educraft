/**
 * The anonymiseerpoort's counters (PR 5): per UTC day and per kind how often the gate found
 * something, how many calls went through it and how many it held back. Instance-wide (the gate's
 * work, not a teacher's), counts only, never a word, and forgotten after `RETENTION_DAYS`.
 * Repository rule: every exported function is `async`.
 */
import { and, gte, lt, lte, sql } from "drizzle-orm";
import type { GateCounts } from "~/lib/privacy/gate";
import { GATE_KINDS, GATE_WINDOW_DAYS, type GateHealth, isSpike } from "~/lib/privacy/gateHealth";
import { getDb } from "../db.server";
import { privacyGateCounts } from "../schema.server";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Long enough for the two weeks on the health screen, short enough to stay small. */
const RETENTION_DAYS = 60;

const dayOf = (at: Date) => at.toISOString().slice(0, 10);
const daysBefore = (at: Date, n: number) => dayOf(new Date(at.getTime() - n * DAY_MS));

/** Adds one call through the gate: what it found per kind, and whether it sent or held back. */
export async function recordGateCall(
  counts: GateCounts,
  sent: boolean,
  now: Date = new Date(),
): Promise<void> {
  const day = dayOf(now);
  const rows = [
    { kind: "call", count: 1 },
    ...(sent ? [] : [{ kind: "stopped", count: 1 }]),
    ...Object.entries(counts)
      .filter(([, n]) => (n ?? 0) > 0)
      .map(([kind, n]) => ({ kind, count: n ?? 0 })),
  ];
  const db = getDb();
  db.transaction((tx) => {
    tx.delete(privacyGateCounts)
      .where(lt(privacyGateCounts.day, daysBefore(now, RETENTION_DAYS)))
      .run();
    for (const row of rows)
      tx.insert(privacyGateCounts)
        .values({ day, ...row })
        .onConflictDoUpdate({
          target: [privacyGateCounts.day, privacyGateCounts.kind],
          set: { count: sql`${privacyGateCounts.count} + ${row.count}` },
        })
        .run();
  });
}

/** Sums per kind between two days, both included. */
function sums(from: string, to: string): Map<string, number> {
  const rows = getDb()
    .select({ kind: privacyGateCounts.kind, n: sql<number>`sum(${privacyGateCounts.count})` })
    .from(privacyGateCounts)
    .where(and(gte(privacyGateCounts.day, from), lte(privacyGateCounts.day, to)))
    .groupBy(privacyGateCounts.kind)
    .all();
  return new Map(rows.map((r) => [r.kind, Number(r.n)]));
}

/** The last seven days (today included) against the seven before, for the health screen. */
export async function gateHealth(now: Date = new Date()): Promise<GateHealth> {
  const w = GATE_WINDOW_DAYS;
  const recent = sums(daysBefore(now, w - 1), dayOf(now));
  const previous = sums(daysBefore(now, 2 * w - 1), daysBefore(now, w));
  const previousCalls = previous.get("call") ?? 0;
  return {
    calls: recent.get("call") ?? 0,
    stopped: recent.get("stopped") ?? 0,
    kinds: GATE_KINDS.map((kind) => {
      const c = { recent: recent.get(kind) ?? 0, previous: previous.get(kind) ?? 0 };
      return { kind, ...c, spike: isSpike({ ...c, previousCalls }) };
    }),
  };
}
