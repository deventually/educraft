/**
 * Monthly AI limits in euros (PR D, BESLUIT-2026-11-11-8): the owner's budget for the whole
 * institution, an admin's limit per team and per teacher. A teacher's own limit replaces the
 * team limits; the budget always counts. From 80% the teacher sees a warning, at 100% the AI
 * stops until the next month. Admins are never limited (the server checks that first). Pure:
 * the server reads the limits from `instance_settings` and the month's spend from `ai_usage`.
 */
import { z } from "zod";

/** From this share on, the teacher is warned. */
const WARN_SHARE = 0.8;
/** Nobody types a monthly limit above this; a typo, not a budget. */
const MAX_EUROS = 1_000_000;

const euros = z.number().finite().positive().max(MAX_EUROS);

export interface AiLimits {
  /** The institution's monthly budget, set by the owner. */
  budget?: number;
  /** Team id → monthly limit. */
  teams: Record<string, number>;
  /** User id → monthly limit; replaces the team limits for that teacher. */
  users: Record<string, number>;
}

function amounts(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [id, value] of Object.entries(raw)) {
    if (euros.safeParse(value).success) out[id] = value as number;
  }
  return out;
}

/** The stored limits; a broken entry is dropped, never the whole set. */
export function parseAiLimits(raw: unknown): AiLimits {
  const o =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const budget = euros.safeParse(o.budget);
  return {
    ...(budget.success ? { budget: budget.data } : {}),
    teams: amounts(o.teams),
    users: amounts(o.users),
  };
}

/** An amount from a form ("12,50", "€ 7.25"): null when empty (remove), "invalid" otherwise. */
export function parseEuroAmount(input: string): number | null | "invalid" {
  const clean = input.replace(/€/g, "").trim().replace(",", ".");
  if (clean === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return "invalid";
  const parsed = euros.safeParse(Number(clean));
  return parsed.success ? parsed.data : "invalid";
}

export type LimitState = "ok" | "warn" | "stop";

export interface AppliedLimit {
  scope: "user" | "team" | "budget";
  /** The team whose limit applies (scope "team"). */
  teamId?: string;
  /** Spent ÷ limit this month. */
  share: number;
  state: LimitState;
}

/** This month's spend in millionths of a euro: the teacher's, per team (its members), everyone's. */
export interface MonthSpend {
  user: number;
  teams: Record<string, number>;
  instance: number;
}

function check(scope: AppliedLimit["scope"], spentMicros: number, limitEuros: number) {
  const share = spentMicros / (limitEuros * 1_000_000);
  const state: LimitState = share >= 1 ? "stop" : share >= WARN_SHARE ? "warn" : "ok";
  return { scope, share, state };
}

/**
 * The limit that binds the teacher now: the one closest to (or past) its end, or null when
 * nothing limits them. The teacher's own limit replaces their teams' limits.
 */
export function applicableLimit(
  limits: AiLimits,
  userId: string,
  teamIds: readonly string[],
  spend: MonthSpend,
): AppliedLimit | null {
  const checks: AppliedLimit[] = [];
  const own = limits.users[userId];
  if (own !== undefined) checks.push(check("user", spend.user, own));
  else {
    for (const teamId of teamIds) {
      const limit = limits.teams[teamId];
      if (limit !== undefined) {
        checks.push({ ...check("team", spend.teams[teamId] ?? 0, limit), teamId });
      }
    }
  }
  if (limits.budget !== undefined) checks.push(check("budget", spend.instance, limits.budget));
  if (checks.length === 0) return null;
  return checks.reduce((a, b) => (b.share > a.share ? b : a));
}
