/**
 * The calendar core of the teacher's week (P22.1). Pure: no I/O, no clock.
 *
 * Dates are ISO calendar dates (`YYYY-MM-DD`) and all arithmetic runs in UTC on
 * whole days, so a daylight saving change never shifts a day. Weeks are ISO
 * weeks (Monday to Sunday). Break weeks and the time zone are institution data,
 * passed in by the caller; this module knows no country or sector.
 */
import { z } from "zod";

/** An ISO calendar date, `YYYY-MM-DD`. */
export type IsoDate = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` and a real calendar date (no 30 February). */
export function isIsoDate(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return toIso(d) === value;
}

export const IsoDateSchema = z.string().refine(isIsoDate, { message: "invalid date" });

function toDate(date: IsoDate): Date {
  return new Date(`${date}T00:00:00Z`);
}

function toIso(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: IsoDate, n: number): IsoDate {
  return toIso(new Date(toDate(date).getTime() + n * DAY_MS));
}

/** The Monday of the ISO week that holds `date`. */
export function mondayOf(date: IsoDate): IsoDate {
  const weekday = (toDate(date).getUTCDay() + 6) % 7; // Monday = 0 … Sunday = 6
  return addDays(date, -weekday);
}

export function addWeeks(date: IsoDate, n: number): IsoDate {
  return addDays(date, 7 * n);
}

/** The ISO week number (1–53): the week that holds the year's first Thursday is week 1. */
export function isoWeek(date: IsoDate): number {
  const thursday = toDate(addDays(mondayOf(date), 3));
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.floor((thursday.getTime() - yearStart) / DAY_MS / 7) + 1;
}

/** At most one year of break weeks per institution. */
export const MAX_BREAK_WEEKS = 52;

/** The institution's time zone until an admin sets another (P22.1). */
export const DEFAULT_TIME_ZONE = "Europe/Amsterdam";

/** Break weeks as their Mondays, without duplicates, in date order. */
export function normalizeBreakWeeks(dates: IsoDate[]): IsoDate[] {
  return [...new Set(dates.map(mondayOf))].sort();
}

/**
 * The Monday of each relative course week, `[0]` being week 1. Week 1 is the
 * week of `startDate`; break weeks are skipped, also when the start falls in one.
 */
export function courseWeekDates(
  startDate: IsoDate,
  breakWeeks: IsoDate[],
  lastWeek: number,
): IsoDate[] {
  const breaks = new Set(breakWeeks.map(mondayOf));
  const out: IsoDate[] = [];
  let monday = mondayOf(startDate);
  while (out.length < lastWeek) {
    if (!breaks.has(monday)) out.push(monday);
    monday = addWeeks(monday, 1);
  }
  return out;
}

export type CourseWeekOn =
  | { kind: "week"; week: number }
  | { kind: "before" }
  | { kind: "after" }
  | { kind: "break" };

/** Where `today` falls in a course that runs `lastWeek` relative weeks. */
export function courseWeekOn(
  startDate: IsoDate,
  breakWeeks: IsoDate[],
  today: IsoDate,
  lastWeek: number,
): CourseWeekOn {
  const monday = mondayOf(today);
  const weeks = courseWeekDates(startDate, breakWeeks, lastWeek);
  const index = weeks.indexOf(monday);
  if (index >= 0) return { kind: "week", week: index + 1 };
  const first = weeks[0];
  const last = weeks[weeks.length - 1];
  if (first === undefined || last === undefined || monday < first) return { kind: "before" };
  if (monday > last) return { kind: "after" };
  return { kind: "break" };
}

/** A valid IANA time zone name. */
export function isTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Today's calendar date in `timeZone` ("today" for the institution). */
export function todayIn(timeZone: string, now: Date): IsoDate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** "16–22 nov" (or with the year) for the ISO week that starts on `monday`. */
export function formatWeekRange(
  monday: IsoDate,
  locale: string,
  opts: { year?: boolean } = {},
): string {
  const fmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    ...(opts.year ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
  return fmt.formatRange(toDate(monday), toDate(addDays(monday, 6)));
}
