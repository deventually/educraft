/**
 * Repository rule: all DB access goes through repositories; every exported function is
 * `async`. The usage dashboard's sums over `ai_usage`, one function per circle of the page
 * (BESLUIT-2026-11-11-1):
 * - `ownAiUsage`: the caller's own rows (scoped to `userId`).
 * - `teamAiUsage`: a team's totals, only for a lead of that team (`getTeamForLead`), never
 *   per person, and no split per tool or model below `MIN_TEAM_BREAKDOWN` active members.
 * - `instanceAiUsage`: everyone, per person and team too. Not user-scoped by design: the
 *   route has already checked `requireRole("admin")`.
 * Every grouped list is capped at 500 rows.
 */
import { and, asc, eq, gte, inArray, lte, type SQL, sql } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { type DayRange, MIN_TEAM_BREAKDOWN, type UsageSums } from "~/lib/usage/summary";
import { getDb } from "../db.server";
import { aiUsage, teamMembers, teams, users } from "../schema.server";
import { getTeamForLead } from "./teams.server";

/** One group's sums: a day, source, model (label: its provider), provider, person or team. */
export type UsageGroup = { key: string; label: string | null } & UsageSums;

export interface UsageReport {
  total: UsageSums;
  /** Per day over the trend range (the page adds them up per week). */
  days: UsageGroup[];
  sources: UsageGroup[];
  models: UsageGroup[];
}

const CAP = 500;

const sums = {
  calls: sql<number>`coalesce(sum(${aiUsage.calls}), 0)`,
  failedCalls: sql<number>`coalesce(sum(${aiUsage.failedCalls}), 0)`,
  unmeteredCalls: sql<number>`coalesce(sum(${aiUsage.unmeteredCalls}), 0)`,
  inputTokens: sql<number>`coalesce(sum(${aiUsage.inputTokens}), 0)`,
  cacheReadTokens: sql<number>`coalesce(sum(${aiUsage.cacheReadTokens}), 0)`,
  cacheWriteTokens: sql<number>`coalesce(sum(${aiUsage.cacheWriteTokens}), 0)`,
  outputTokens: sql<number>`coalesce(sum(${aiUsage.outputTokens}), 0)`,
  reasoningTokens: sql<number>`coalesce(sum(${aiUsage.reasoningTokens}), 0)`,
  costMicros: sql<number>`coalesce(sum(${aiUsage.costMicros}), 0)`,
  unpricedCalls: sql<number>`coalesce(sum(${aiUsage.unpricedCalls}), 0)`,
};

const within = (range: DayRange) =>
  and(gte(aiUsage.day, range.from), lte(aiUsage.day, range.until));

function total(where: SQL | undefined): UsageSums {
  return getDb().select(sums).from(aiUsage).where(where).get() as UsageSums;
}

/** Sums per value of `key` (label: `label`, or null), ordered by key. */
function grouped(where: SQL | undefined, key: SQLiteColumn, label?: SQLiteColumn): UsageGroup[] {
  return getDb()
    .select({
      key: sql<string>`${key}`,
      label: label ? sql<string | null>`max(${label})` : sql<null>`null`,
      ...sums,
    })
    .from(aiUsage)
    .where(where)
    .groupBy(key)
    .orderBy(asc(key))
    .limit(CAP)
    .all();
}

function report(where: SQL | undefined, month: DayRange, trend: DayRange): UsageReport {
  const inMonth = and(where, within(month));
  return {
    total: total(inMonth),
    days: grouped(and(where, within(trend)), aiUsage.day),
    sources: grouped(inMonth, aiUsage.source),
    models: grouped(inMonth, aiUsage.model, aiUsage.provider),
  };
}

/** The caller's own use. */
export async function ownAiUsage(
  userId: string,
  month: DayRange,
  trend: DayRange,
): Promise<UsageReport> {
  return report(eq(aiUsage.userId, userId), month, trend);
}

/**
 * A team's totals for its lead, or `null` when `callerId` does not lead it. The members are
 * today's members; `activeMembers` counts those who used AI in the month.
 */
export async function teamAiUsage(
  callerId: string,
  teamId: string,
  month: DayRange,
  trend: DayRange,
): Promise<(UsageReport & { activeMembers: number }) | null> {
  if (!(await getTeamForLead(callerId, teamId))) return null;
  const members = getDb()
    .select({ id: teamMembers.userId })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId));
  const where = inArray(aiUsage.userId, members);
  const r = report(where, month, trend);
  const active = getDb()
    .select({ n: sql<number>`count(distinct ${aiUsage.userId})` })
    .from(aiUsage)
    .where(and(where, within(month)))
    .get();
  const activeMembers = active?.n ?? 0;
  if (activeMembers >= MIN_TEAM_BREAKDOWN) return { ...r, activeMembers };
  return { ...r, sources: [], models: [], activeMembers };
}

/** Everyone's use, also per person, per team (a person in two teams counts in both) and provider. */
export async function instanceAiUsage(
  month: DayRange,
  trend: DayRange,
): Promise<UsageReport & { users: UsageGroup[]; teams: UsageGroup[]; providers: UsageGroup[] }> {
  const inMonth = within(month);
  const perUser = getDb()
    .select({ key: aiUsage.userId, label: sql<string | null>`max(${users.name})`, ...sums })
    .from(aiUsage)
    .leftJoin(users, eq(users.id, aiUsage.userId))
    .where(inMonth)
    .groupBy(aiUsage.userId)
    .orderBy(asc(sql`max(${users.name})`))
    .limit(CAP)
    .all();
  const perTeam = getDb()
    .select({ key: teams.id, label: sql<string | null>`max(${teams.name})`, ...sums })
    .from(aiUsage)
    .innerJoin(teamMembers, eq(teamMembers.userId, aiUsage.userId))
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(inMonth)
    .groupBy(teams.id)
    .orderBy(asc(sql`max(${teams.name})`))
    .limit(CAP)
    .all();
  return {
    ...report(undefined, month, trend),
    users: perUser,
    teams: perTeam,
    providers: grouped(inMonth, aiUsage.provider),
  };
}
