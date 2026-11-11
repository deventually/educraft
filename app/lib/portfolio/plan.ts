/**
 * The day plan of a dossier (step 7 of the guided route): what is left in hours, laid out over
 * working days in the order of the route. Fixed, visible rates per open milestone; pure and
 * advisory like `dossierRoute`: it changes nothing, uses no AI and never blocks.
 */
import { requirementChecklist, requirementMet } from "./requirements";
import { dossierRoute, outcomeRoute } from "./route";
import type { DossierData } from "./types";

/** Minutes per open unit; shown to the teacher as they are. */
export const PLAN_MINUTES = {
  /** No framework yet: the start wizard and getting the framework from the forms. */
  framework: 120,
  /** A framework that is in but not confirmed: checking it. */
  frameworkCheck: 30,
  /** Per criterion or required line without evidence. */
  evidence: 15,
  /** While the chapter is still empty: a start, then per criterion. */
  chapterStart: 60,
  chapter: 30,
  /** Per criterion the coach (or the teacher) has not yet found shown. */
  review: 20,
  /** Per criterion the teacher has not yet marked shown. */
  shown: 5,
  /** The check, the rehearsal and the export. */
  finish: 240,
} as const;

export const DEFAULT_HOURS_PER_DAY = 8;

export interface WorkItem {
  /** "framework", "finish", or the outcome's id. */
  id: string;
  kind: "framework" | "outcome" | "finish";
  outcomeId?: string;
  minutes: number;
}

function outcomeMinutes(d: DossierData, outcomeId: string): number {
  const r = outcomeRoute(d, outcomeId);
  if (!r) return 0;
  const open = (i: number) => {
    const m = r.milestones[i];
    return m ? m.total - m.done : 0;
  };
  const criteria = r.milestones[2]?.total ?? 0;
  return (
    open(0) * PLAN_MINUTES.evidence +
    (open(1) > 0 ? PLAN_MINUTES.chapterStart + criteria * PLAN_MINUTES.chapter : 0) +
    open(2) * PLAN_MINUTES.review +
    open(3) * PLAN_MINUTES.shown
  );
}

/** What is left, step by step in the order of the route; done steps are left out. */
export function remainingWork(d: DossierData): { items: WorkItem[]; minutes: number } {
  const items = dossierRoute(d)
    .steps.filter((s) => !s.complete)
    .map((s): WorkItem => {
      if (s.kind === "outcome") {
        const outcomeId = s.outcomeId ?? s.id;
        return { id: s.id, kind: s.kind, outcomeId, minutes: outcomeMinutes(d, outcomeId) };
      }
      if (s.kind === "framework") {
        const some = d.framework.outcomes.some((o) => o.criteria.length > 0);
        return {
          id: s.id,
          kind: s.kind,
          minutes: some ? PLAN_MINUTES.frameworkCheck : PLAN_MINUTES.framework,
        };
      }
      return { id: s.id, kind: s.kind, minutes: PLAN_MINUTES.finish };
    })
    .filter((i) => i.minutes > 0);
  return { items, minutes: items.reduce((sum, i) => sum + i.minutes, 0) };
}

/** Minutes as hours, rounded up to half an hour; 0 only for no work at all. */
export const hoursOf = (minutes: number): number =>
  minutes <= 0 ? 0 : Math.ceil(minutes / 30) / 2;

const DAY = 86_400_000;
const isWorkday = (t: number) => {
  const day = new Date(t).getUTCDay();
  return day !== 0 && day !== 6;
};

/** Monday to Friday from `from` up to, not including, `to` (ISO dates, UTC). */
export function workdaysBetween(from: string, to: string): number {
  let n = 0;
  for (let t = Date.parse(from); t < Date.parse(to); t += DAY) if (isWorkday(t)) n++;
  return n;
}

/** Today as an ISO date (UTC), the same day `daysUntil` counts from. */
export const isoDay = (now: number): string => new Date(now).toISOString().slice(0, 10);

/** Required evidence that comes from someone else: ask for it before writing. */
const FROM_OTHERS =
  /feedback|opname|video|film|observ|record|deskundig|collega|begeleider|mentor|peer|expert/i;

export interface PlanDay {
  date: string;
  items: WorkItem[];
}

export interface DayPlan {
  /** What is left per step, whole (the days split it). */
  items: WorkItem[];
  minutes: number;
  hoursPerDay: number;
  days: PlanDay[];
  /** With a hand-in date: the working days before it, and whether the plan fits. */
  deadline?: { date: string; workdays: number; onTrack: boolean; shortBy: number };
  /** Missing required evidence from others, per outcome: ask for it today. */
  askNow: { outcomeId: string; line: string }[];
}

/** The remaining work over working days of `hoursPerDay`, starting `today` (an ISO date). */
export function dayPlan(d: DossierData, today: string, hoursPerDay?: number): DayPlan {
  const perDay = hoursPerDay ?? d.hoursPerDay ?? DEFAULT_HOURS_PER_DAY;
  const capacity = perDay * 60;
  const { items, minutes } = remainingWork(d);
  const days: PlanDay[] = [];
  let t = Date.parse(today);
  let day: PlanDay | null = null;
  let room = 0;
  for (const item of items) {
    let left = item.minutes;
    while (left > 0) {
      if (!day || room === 0) {
        while (!isWorkday(t)) t += DAY;
        day = { date: isoDay(t), items: [] };
        days.push(day);
        room = capacity;
        t += DAY;
      }
      const take = Math.min(left, room);
      day.items.push({ ...item, minutes: take });
      left -= take;
      room -= take;
    }
  }
  const askNow = d.framework.outcomes.flatMap((o) =>
    requirementChecklist(d, o.id)
      .filter((r) => !requirementMet(r) && FROM_OTHERS.test(r.line))
      .map((r) => ({ outcomeId: o.id, line: r.line })),
  );
  const plan: DayPlan = { items, minutes, hoursPerDay: perDay, days, askNow };
  if (d.deadline) {
    const workdays = workdaysBetween(today, d.deadline);
    plan.deadline = {
      date: d.deadline,
      workdays,
      onTrack: days.length <= workdays,
      shortBy: Math.max(0, days.length - workdays),
    };
  }
  return plan;
}
