/**
 * Deterministic alignment checks (brief P20, 20.1). Pure and advisory: they
 * describe gaps, they never change the course. The base for the P21 agents.
 */
import { type BloomLevel, bloomRank } from "./bloom";
import { type Assessment, type AssessmentCoverage, type CourseData, HOURS_PER_EC } from "./types";

export const FINDING_CODES = [
  "outcome-not-taught",
  "outcome-not-assessed",
  "assessed-before-taught",
  "bloom-below-outcome",
  "activity-without-outcome",
  "discipline-without-outcome",
  "weights-not-100",
  "study-load-exceeds-ec",
  "outcome-single-item",
  "item-bloom-below-outcome",
  "items-without-points",
] as const;
export type FindingCode = (typeof FINDING_CODES)[number];

export interface AlignmentFinding {
  code: FindingCode;
  severity: "warning" | "info";
  outcomeId?: string;
  itemId?: string;
  /** The question of an assessment (`itemId`) a question-level finding is about. */
  questionId?: string;
  /** The discipline a discipline-level finding is about. */
  disciplineId?: string;
}

export interface MatrixCell {
  covered: boolean;
  bloom?: BloomLevel;
  /** Number of questions, when the assessment has a question-level matrix. */
  items?: number;
}

const hasItems = (a: Assessment): boolean => (a.items?.length ?? 0) > 0;

/**
 * What an assessment covers. With questions (P26.1) they are the one source of
 * truth: per outcome (in order of first question) the lowest Bloom level of its
 * questions, so `bloom-below-outcome` stays strict. Without, the P20 coverage.
 */
export function effectiveCoverage(a: Assessment): AssessmentCoverage[] {
  if (!a.items || !hasItems(a)) return a.coverage;
  const byOutcome = new Map<string, BloomLevel | undefined>();
  for (const item of a.items) {
    const prev = byOutcome.get(item.outcomeId);
    const lowest =
      prev && item.bloom
        ? bloomRank(item.bloom) < bloomRank(prev)
          ? item.bloom
          : prev
        : (prev ?? item.bloom);
    byOutcome.set(item.outcomeId, lowest);
  }
  return [...byOutcome].map(([outcomeId, bloom]) => (bloom ? { outcomeId, bloom } : { outcomeId }));
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
          const c = effectiveCoverage(a).find((x) => x.outcomeId === o.id);
          if (!c) return { covered: false };
          const cell: MatrixCell = c.bloom ? { covered: true, bloom: c.bloom } : { covered: true };
          if (hasItems(a)) cell.items = a.items?.filter((i) => i.outcomeId === o.id).length;
          return cell;
        }),
      ],
    })),
  };
}

/**
 * Findings in a fixed order: per outcome (in outcome order: assessment-level
 * findings in assessment order, then not-taught, then not-assessed), then per
 * activity, then per discipline, then the course-wide weight and study-load checks, then the
 * question-level checks per assessment (P26.1).
 */
export function checkAlignment(d: CourseData): AlignmentFinding[] {
  const findings: AlignmentFinding[] = [];
  const summative = d.assessments.filter((a) => a.kind === "summative");

  for (const o of d.outcomes) {
    const teaching = d.activities.filter((a) => a.outcomeIds.includes(o.id));
    const taughtWeeks = teaching.flatMap((a) => (a.week === undefined ? [] : [a.week]));
    const firstTaught = taughtWeeks.length ? Math.min(...taughtWeeks) : undefined;

    for (const a of d.assessments) {
      const c = effectiveCoverage(a).find((x) => x.outcomeId === o.id);
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
      // With questions, item-bloom-below-outcome says it per question instead.
      if (!hasItems(a) && o.bloom && c.bloom && bloomRank(c.bloom) < bloomRank(o.bloom))
        findings.push({
          code: "bloom-below-outcome",
          severity: "warning",
          outcomeId: o.id,
          itemId: a.id,
        });
    }
    if (teaching.length === 0)
      findings.push({ code: "outcome-not-taught", severity: "warning", outcomeId: o.id });
    if (!summative.some((a) => effectiveCoverage(a).some((c) => c.outcomeId === o.id)))
      findings.push({ code: "outcome-not-assessed", severity: "warning", outcomeId: o.id });
  }

  for (const a of d.activities)
    if (a.outcomeIds.length === 0)
      findings.push({ code: "activity-without-outcome", severity: "info", itemId: a.id });

  // A discipline whose lessons together serve no outcome; waits until there are outcomes.
  if (d.outcomes.length > 0)
    for (const x of d.disciplines ?? [])
      if (!d.activities.some((a) => a.disciplineId === x.id && a.outcomeIds.length > 0))
        findings.push({
          code: "discipline-without-outcome",
          severity: "warning",
          disciplineId: x.id,
        });

  const weights = summative.flatMap((a) => (a.weight === undefined ? [] : [a.weight]));
  if (weights.length > 0 && Math.abs(weights.reduce((s, w) => s + w, 0) - 100) > 0.01)
    findings.push({ code: "weights-not-100", severity: "info" });

  const hours = [...d.activities, ...d.assessments].reduce((s, i) => s + (i.hours ?? 0), 0);
  if (d.ec !== undefined && hours > d.ec * HOURS_PER_EC)
    findings.push({ code: "study-load-exceeds-ec", severity: "info" });

  for (const a of d.assessments) findings.push(...itemFindings(d, a));

  return findings;
}

function itemFindings(d: CourseData, a: Assessment): AlignmentFinding[] {
  const items = a.items ?? [];
  if (items.length === 0) return [];
  const findings: AlignmentFinding[] = [];
  if (a.kind === "summative")
    for (const o of d.outcomes)
      if (items.filter((i) => i.outcomeId === o.id).length === 1)
        findings.push({
          code: "outcome-single-item",
          severity: "warning",
          outcomeId: o.id,
          itemId: a.id,
        });
  for (const item of items) {
    const outcome = d.outcomes.find((o) => o.id === item.outcomeId);
    if (outcome?.bloom && item.bloom && bloomRank(item.bloom) < bloomRank(outcome.bloom))
      findings.push({
        code: "item-bloom-below-outcome",
        severity: "warning",
        outcomeId: outcome.id,
        itemId: a.id,
        questionId: item.id,
      });
  }
  const withPoints = items.filter((i) => i.points !== undefined).length;
  if (withPoints > 0 && withPoints < items.length)
    findings.push({ code: "items-without-points", severity: "info", itemId: a.id });
  return findings;
}
