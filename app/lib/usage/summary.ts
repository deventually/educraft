/**
 * The usage dashboard's arithmetic (PR C): which days a month covers, the weekly trend, the
 * cache share, the month forecast and what caching saved. Pure; the server reads the sums
 * from `ai_usage` and decides who sees what (`usageScopeFor`).
 */
import type { ModelPrice } from "~/lib/ai/prices";

/** The counters of `ai_usage`, added up over any group of rows. */
export interface UsageSums {
  calls: number;
  failedCalls: number;
  unmeteredCalls: number;
  inputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  costMicros: number;
  unpricedCalls: number;
}

/** Inclusive UTC days, "YYYY-MM-DD". */
export interface DayRange {
  from: string;
  until: string;
}

/** How many months back the page goes: a school year plus the same month last year. */
const MONTHS_BACK = 12;
/** The trend shows this many whole weeks. */
const TREND_WEEKS = 8;
/**
 * A team with fewer active members shows totals only, no split per tool or model, so no
 * colleague can be singled out (BESLUIT-2026-11-11-1).
 */
export const MIN_TEAM_BREAKDOWN = 3;

const DAY_MS = 86_400_000;
const toDate = (day: string) => new Date(`${day}T00:00:00Z`);
const toDay = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (day: string, n: number) => toDay(new Date(toDate(day).getTime() + n * DAY_MS));

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

function lastDayOf(month: string): string {
  return addDays(`${shiftMonth(month, 1)}-01`, -1);
}

/** The months the page offers, newest first: this month and the twelve before. */
export function monthOptions(today: string): string[] {
  const current = today.slice(0, 7);
  return Array.from({ length: MONTHS_BACK + 1 }, (_, i) => shiftMonth(current, -i));
}

/** The asked month when the page offers it, else the current one. */
export function parseMonth(asked: string | null, today: string): string {
  return asked && monthOptions(today).includes(asked) ? asked : today.slice(0, 7);
}

/** Monday of the week `day` is in. */
function weekOf(day: string): string {
  const weekday = (toDate(day).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(day, -weekday);
}

/** The month's days (up to today) and the eight whole weeks that end with it. */
export function usageRanges(month: string, today: string): { month: DayRange; trend: DayRange } {
  const last = lastDayOf(month);
  const until = last < today ? last : today;
  return {
    month: { from: `${month}-01`, until },
    trend: { from: addDays(weekOf(until), -7 * (TREND_WEEKS - 1)), until },
  };
}

/** Calls and cost per week (keyed by its Monday), every week of the range, empty ones too. */
export function weeklyCalls(
  days: readonly { key: string; calls: number; costMicros: number }[],
  range: DayRange,
): { week: string; calls: number; costMicros: number }[] {
  const weeks = new Map<string, { week: string; calls: number; costMicros: number }>();
  for (let w = weekOf(range.from); w <= range.until; w = addDays(w, 7)) {
    weeks.set(w, { week: w, calls: 0, costMicros: 0 });
  }
  for (const d of days) {
    const bucket = weeks.get(weekOf(d.key));
    if (!bucket) continue;
    bucket.calls += d.calls;
    bucket.costMicros += d.costMicros;
  }
  return [...weeks.values()];
}

/** The part of all input that came from the cache, or null without input. */
export function cacheShare(s: UsageSums): number | null {
  const all = s.inputTokens + s.cacheReadTokens + s.cacheWriteTokens;
  return all === 0 ? null : s.cacheReadTokens / all;
}

/** The month's cost so far, projected to the whole month; a past month is its real total. */
export function forecastMicros(costMicros: number, month: string, today: string): number {
  if (today.slice(0, 7) !== month) return costMicros;
  const elapsed = Number(today.slice(8, 10));
  const length = Number(lastDayOf(month).slice(8, 10));
  return Math.round((costMicros / elapsed) * length);
}

/**
 * What caching saved, in millionths of a euro, at today's prices: every token read from the
 * cache cost less than input, every token written to it a little more. Models without a
 * price count for nothing.
 */
export function cacheSavingsMicros(
  perModel: readonly ({ key: string } & UsageSums)[],
  priceOf: (model: string) => ModelPrice | undefined,
): number {
  let micros = 0; // tokens × euro per million tokens = millionths of a euro
  for (const row of perModel) {
    const p = priceOf(row.key);
    if (!p) continue;
    micros += row.cacheReadTokens * (p.input - (p.cacheRead ?? p.input));
    micros -= row.cacheWriteTokens * ((p.cacheWrite ?? p.input) - p.input);
  }
  return Math.round(micros);
}
