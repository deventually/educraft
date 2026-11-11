/**
 * The monthly AI limits in euros (PR D, BESLUIT-2026-11-11-7), checked before every AI call
 * and shown on the tool page and the usage page. Admins are never limited. Which limit binds
 * is pure (`applicableLimit`); this module reads the limits, the teacher's teams and the
 * month's spend.
 */
import { type AppliedLimit, applicableLimit } from "~/lib/usage/limits";
import type { User } from "./auth.server";
import { getAiLimits } from "./repositories/aiLimits.server";
import { monthSpend } from "./repositories/aiUsageReports.server";
import { listTeamsForUser } from "./repositories/teams.server";
import { checkQuota } from "./repositories/usage.server";

/** The limit that binds `user` this month, with the name of its team; null = no limit. */
export async function aiLimitFor(
  user: Pick<User, "id" | "role">,
  today = new Date().toISOString().slice(0, 10),
): Promise<(AppliedLimit & { teamName?: string }) | null> {
  if (user.role === "admin") return null;
  const limits = await getAiLimits();
  const own = limits.users[user.id] !== undefined;
  const teams = own ? [] : (await listTeamsForUser(user.id)).filter((t) => t.id in limits.teams);
  if (!own && teams.length === 0 && limits.budget === undefined) return null;
  const month = { from: `${today.slice(0, 7)}-01`, until: today };
  const spend = await monthSpend(
    user.id,
    teams.map((t) => t.id),
    month,
  );
  const applied = applicableLimit(
    limits,
    user.id,
    teams.map((t) => t.id),
    spend,
  );
  if (!applied) return null;
  const teamName = teams.find((t) => t.id === applied.teamId)?.name;
  return teamName ? { ...applied, teamName } : applied;
}

/** Whether `user` may not call AI any more this month. */
async function aiLimitReached(user: Pick<User, "id" | "role">): Promise<boolean> {
  return (await aiLimitFor(user))?.state === "stop";
}

/**
 * Why `user` may not call AI now: over the daily quota (the safety net), or past the monthly
 * limit in euros; null when they may. Admins are never stopped.
 */
export async function aiGate(user: Pick<User, "id" | "role">): Promise<"quota" | "limit" | null> {
  if (user.role === "admin") return null;
  if (!(await checkQuota(user.id)).ok) return "quota";
  return (await aiLimitReached(user)) ? "limit" : null;
}
