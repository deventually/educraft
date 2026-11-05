/**
 * The course per week (P27.4): its lessons and tests grouped by course week, those
 * without a week at the bottom. Pure and derived, never stored.
 */
import type { CourseData } from "./types";

export interface PlanItem {
  id: string;
  title: string;
  kind: "activity" | "assessment";
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
