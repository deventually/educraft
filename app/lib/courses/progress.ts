/**
 * How far a course is, as the steps of backwards design: details, learning outcomes, then how
 * they are assessed, then the lessons towards that, the weeks, and the check. Pure and advisory,
 * like `checkAlignment`: it reads the course and its findings, never changes them, uses no AI.
 */
import type { AlignmentFinding as Finding } from "./alignment";
import type { CourseTab } from "./tabs";
import type { CourseData } from "./types";

type ProgressStepId = "details" | "outcomes" | "assessments" | "lessons" | "weeks" | "check";

export interface ProgressStep {
  id: ProgressStepId;
  /** The tab where the teacher does this step. */
  tab: CourseTab;
  /** The section on that tab, when the tab holds more than this step. */
  anchor?: string;
  complete: boolean;
  /** What is done of this step, out of `total` (outcomes assessed, items with a week, …). */
  done: number;
  total: number;
}

export interface CourseProgress {
  steps: ProgressStep[];
  complete: number;
  total: number;
  /** The first step that is not complete, or null when all are. */
  next: ProgressStep | null;
}

export function courseProgress(d: CourseData, findings: Finding[]): CourseProgress {
  const outcomes = d.outcomes.length;
  const missing = (code: Finding["code"]) => findings.filter((f) => f.code === code).length;
  const items = [...d.activities, ...d.assessments];
  const planned = items.filter((i) => i.week !== undefined).length;
  const assessed = outcomes - missing("outcome-not-assessed");
  const taught = outcomes - missing("outcome-not-taught");
  const steps: ProgressStep[] = [
    {
      id: "details",
      tab: "overview",
      anchor: "course-settings",
      ...count(d.ec === undefined ? 0 : 1, 1),
    },
    { id: "outcomes", tab: "outcomes", ...count(outcomes, outcomes) },
    {
      id: "assessments",
      tab: "plan",
      ...count(assessed, outcomes),
      complete:
        outcomes > 0 && d.assessments.some((a) => a.kind === "summative") && assessed === outcomes,
    },
    {
      id: "lessons",
      tab: "plan",
      ...count(taught, outcomes),
      complete: outcomes > 0 && taught === outcomes && d.activities.length > 0,
    },
    {
      id: "weeks",
      tab: "plan",
      ...count(planned, items.length),
      complete: outcomes > 0 && items.length > 0 && planned === items.length,
    },
    {
      id: "check",
      tab: "check",
      done: 0,
      total: findings.length,
      complete: outcomes > 0 && findings.length === 0,
    },
  ];
  return {
    steps,
    complete: steps.filter((s) => s.complete).length,
    total: steps.length,
    next: steps.find((s) => !s.complete) ?? null,
  };
}

const count = (done: number, total: number) => ({
  done,
  total,
  complete: total > 0 && done === total,
});
