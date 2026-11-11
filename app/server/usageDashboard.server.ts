/**
 * The usage page (PR C): one route, and the server decides which circle each viewer sees
 * (BESLUIT-2026-11-11-1). A teacher sees their own calls and today's quota; a team lead also
 * each led team's totals (never per person, never money); an admin everyone, per person and
 * with costs; the owner on top the month forecast and what caching saved. What a viewer may
 * not see is left out of the loader data, not hidden in the UI.
 */
import { effectivePrice, getProvider, isResolvableModel, resolveModelInfo } from "~/lib/ai/models";
import {
  cacheSavingsMicros,
  cacheShare,
  forecastMicros,
  monthOptions,
  parseMonth,
  usageRanges,
  weeklyCalls,
} from "~/lib/usage/summary";
import { isOwner, type User } from "./auth.server";
import { env } from "./env.server";
import { aiLimitFor } from "./aiLimits.server";
import { limitsView } from "./aiLimitsAdmin.server";
import {
  type UsageGroup,
  instanceAiUsage,
  ownAiUsage,
  teamAiUsage,
} from "./repositories/aiUsageReports.server";
import { getModelPrices } from "./repositories/modelPrices.server";
import { listTeamsForUser } from "./repositories/teams.server";
import { getTodayUsage, utcDay } from "./repositories/usage.server";

interface UsageScope {
  /** The teams the viewer leads. */
  leadTeams: { id: string; name: string }[];
  /** Everyone, per person, with costs: an admin. */
  instance: boolean;
  /** The forecast and the cache savings too: the owner. */
  owner: boolean;
}

async function usageScopeFor(user: User): Promise<UsageScope> {
  const teams = await listTeamsForUser(user.id);
  return {
    leadTeams: teams.filter((t) => t.isLead).map(({ id, name }) => ({ id, name })),
    instance: user.role === "admin",
    owner: await isOwner(user),
  };
}

/** Most used first. */
const byCalls = <T extends { calls: number }>(groups: T[]) =>
  [...groups].sort((a, b) => b.calls - a.calls);
/** Calls only, most used first: what a teacher or a lead sees per group. */
const callsOf = (groups: UsageGroup[]) => byCalls(groups.map(({ key, calls }) => ({ key, calls })));
/** A model's name for a reader; an id the catalog no longer knows stays an id. */
const withName = <T extends { key: string }>(models: T[]) =>
  models.map((m) => ({
    ...m,
    name: isResolvableModel(m.key) ? resolveModelInfo(m.key).displayName : m.key,
  }));
/** The provider's name (in `label`) for a group whose label or key is a provider id. */
const providerNamed = <T extends UsageGroup>(groups: T[], idOf: (g: T) => string | null) =>
  groups.map((g) => {
    const id = idOf(g);
    return { ...g, label: id === null ? null : (getProvider(id)?.name ?? id) };
  });
const weeksOf = (weeks: ReturnType<typeof weeklyCalls>) =>
  weeks.map(({ week, calls }) => ({ week, calls }));

export async function loadUsageDashboard(user: User, askedMonth: string | null, today = utcDay()) {
  const scope = await usageScopeFor(user);
  const month = parseMonth(askedMonth, today);
  const ranges = usageRanges(month, today);
  const own = await ownAiUsage(user.id, ranges.month, ranges.trend);
  const used = (await getTodayUsage(user.id, today)).requests;

  const teams = [];
  for (const team of scope.leadTeams) {
    const r = await teamAiUsage(user.id, team.id, ranges.month, ranges.trend);
    if (!r) continue;
    teams.push({
      ...team,
      activeMembers: r.activeMembers,
      calls: r.total.calls,
      weeks: weeksOf(weeklyCalls(r.days, ranges.trend)),
      sources: callsOf(r.sources),
      models: withName(callsOf(r.models)),
    });
  }

  const all = scope.instance ? await instanceAiUsage(ranges.month, ranges.trend) : null;
  const instance = all && {
    total: all.total,
    cacheShare: cacheShare(all.total),
    weeks: weeklyCalls(all.days, ranges.trend),
    users: all.users,
    teams: all.teams,
    sources: byCalls(all.sources),
    models: byCalls(withName(providerNamed(all.models, (m) => m.label as string | null))),
    providers: byCalls(providerNamed(all.providers, (p) => p.key)),
  };

  let money = null;
  if (all && scope.owner) {
    const prices = await getModelPrices();
    money = {
      currentMonth: month === today.slice(0, 7),
      forecastMicros: forecastMicros(all.total.costMicros, month, today),
      savingsMicros: cacheSavingsMicros(all.models, (m) => effectivePrice(m, prices)?.price),
    };
  }

  return {
    month,
    months: monthOptions(today),
    own: {
      calls: own.total.calls,
      failedCalls: own.total.failedCalls,
      weeks: weeksOf(weeklyCalls(own.days, ranges.trend)),
      sources: callsOf(own.sources),
      models: withName(callsOf(own.models)),
      // Admins have no daily limit.
      quota: user.role === "admin" ? null : { used, limit: env.DAILY_REQUEST_LIMIT },
      // This month's limit (PR D) as a share, never in euros: a teacher sees no money.
      limit: await aiLimitFor(user, today),
    },
    limits: scope.instance ? await limitsView(scope.owner) : null,
    teams,
    instance,
    money,
  };
}
