/**
 * The course per week (P27.4): its lessons and tests grouped by course week, those
 * without a week at the bottom. Pure and derived, never stored.
 */
import type { CourseData } from "./types";

export interface PlanItem {
  id: string;
  title: string;
  kind: "activity" | "assessment";
  /** The discipline that teaches a lesson, when the course has disciplines. */
  disciplineId?: string;
}

export interface WeekPlan {
  weeks: { week: number; items: PlanItem[] }[];
  unscheduled: PlanItem[];
}

export function weekPlan(data: CourseData): WeekPlan {
  const all = [
    ...data.activities.map((a) => ({
      id: a.id,
      title: a.title,
      kind: "activity" as const,
      week: a.week,
      ...(a.disciplineId !== undefined && { disciplineId: a.disciplineId }),
    })),
    ...data.assessments.map((a) => ({
      id: a.id,
      title: a.title,
      kind: "assessment" as const,
      week: a.week,
    })),
  ];
  const byWeek = new Map<number, PlanItem[]>();
  const unscheduled: PlanItem[] = [];
  for (const { week, ...item } of all) {
    if (week === undefined) unscheduled.push(item);
    else byWeek.set(week, [...(byWeek.get(week) ?? []), item]);
  }
  const weeks = [...byWeek.entries()]
    .sort(([a], [b]) => a - b)
    .map(([week, items]) => ({ week, items }));
  return { weeks, unscheduled };
}

/**
 * The plan for one discipline: its lessons and every test, since a test belongs to the
 * whole course. Weeks left empty drop out. Without a discipline the plan stays as it is.
 */
export function forDiscipline(plan: WeekPlan, disciplineId: string | null): WeekPlan {
  if (disciplineId === null) return plan;
  const keep = (items: PlanItem[]) =>
    items.filter((i) => i.kind === "assessment" || i.disciplineId === disciplineId);
  return {
    weeks: plan.weeks
      .map((w) => ({ week: w.week, items: keep(w.items) }))
      .filter((w) => w.items.length > 0),
    unscheduled: keep(plan.unscheduled),
  };
}
