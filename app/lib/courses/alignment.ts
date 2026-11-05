/**
 * Deterministic alignment checks (brief P20, 20.1). Pure and advisory: they
 * describe gaps, they never change the course. The base for the P21 agents.
 */
import { type BloomLevel, bloomRank } from "./bloom";
import { type CourseData, HOURS_PER_EC } from "./types";

export const FINDING_CODES = [
  "outcome-not-taught",
  "outcome-not-assessed",
  "assessed-before-taught",
  "bloom-below-outcome",
  "activity-without-outcome",
  "weights-not-100",
  "study-load-exceeds-ec",
] as const;
export type FindingCode = (typeof FINDING_CODES)[number];

export interface AlignmentFinding {
  code: FindingCode;
  severity: "warning" | "info";
  outcomeId?: string;
  itemId?: string;
}

export interface MatrixCell {
  covered: boolean;
  bloom?: BloomLevel;
}

export interface CoverageMatrix {
  columns: { id: string; kind: "activity" | "assessment" }[];
  rows: { outcomeId: string; cells: MatrixCell[] }[];
}

/** Rows = outcomes; columns = activities, then assessments. */
export function coverageMatrix(d: CourseData): CoverageMatrix {
  return {
    columns: [
      ...d.activities.map((a) => ({ id: a.id, kind: "activity" as const })),
      ...d.assessments.map((a) => ({ id: a.id, kind: "assessment" as const })),
    ],
    rows: d.outcomes.map((o) => ({
      outcomeId: o.id,
      cells: [
        ...d.activities.map((a) => ({ covered: a.outcomeIds.includes(o.id) })),
        ...d.assessments.map((a): MatrixCell => {
          const c = a.coverage.find((x) => x.outcomeId === o.id);
          if (!c) return { covered: false };
          return c.bloom ? { covered: true, bloom: c.bloom } : { covered: true };
        }),
      ],
    })),
  };
}

/**
 * Findings in a fixed order: per outcome (in outcome order: assessment-level
 * findings in assessment order, then not-taught, then not-assessed), then per
 * activity, then the course-wide weight and study-load checks.
 */
export function checkAlignment(d: CourseData): AlignmentFinding[] {
  const findings: AlignmentFinding[] = [];
  const summative = d.assessments.filter((a) => a.kind === "summative");

  for (const o of d.outcomes) {
    const teaching = d.activities.filter((a) => a.outcomeIds.includes(o.id));
    const taughtWeeks = teaching.flatMap((a) => (a.week === undefined ? [] : [a.week]));
    const firstTaught = taughtWeeks.length ? Math.min(...taughtWeeks) : undefined;

    for (const a of d.assessments) {
      const c = a.coverage.find((x) => x.outcomeId === o.id);
      if (!c) continue;
      if (
        a.kind === "summative" &&
        a.week !== undefined &&
        firstTaught !== undefined &&
        a.week < firstTaught
      )
        findings.push({
          code: "assessed-before-taught",
          severity: "warning",
          outcomeId: o.id,
          itemId: a.id,
        });
      if (o.bloom && c.bloom && bloomRank(c.bloom) < bloomRank(o.bloom))
        findings.push({
          code: "bloom-below-outcome",
          severity: "warning",
          outcomeId: o.id,
          itemId: a.id,
        });
    }
    if (teaching.length === 0)
      findings.push({ code: "outcome-not-taught", severity: "warning", outcomeId: o.id });
    if (!summative.some((a) => a.coverage.some((c) => c.outcomeId === o.id)))
      findings.push({ code: "outcome-not-assessed", severity: "warning", outcomeId: o.id });
  }

  for (const a of d.activities)
    if (a.outcomeIds.length === 0)
      findings.push({ code: "activity-without-outcome", severity: "info", itemId: a.id });

  const weights = summative.flatMap((a) => (a.weight === undefined ? [] : [a.weight]));
  if (weights.length > 0 && Math.abs(weights.reduce((s, w) => s + w, 0) - 100) > 0.01)
    findings.push({ code: "weights-not-100", severity: "info" });

  const hours = [...d.activities, ...d.assessments].reduce((s, i) => s + (i.hours ?? 0), 0);
  if (d.ec !== undefined && hours > d.ec * HOURS_PER_EC)
    findings.push({ code: "study-load-exceeds-ec", severity: "info" });

  return findings;
}
