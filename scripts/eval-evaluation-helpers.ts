/**
 * Pure helpers for the course-evaluation eval (`npm run eval:evaluation`, brief P33.2): score a
 * checked answer deterministically against the rules of the prompt. Whether the themes and
 * improvements are GOOD is read by a person in the saved answers (`rubric.md`).
 */
import type { EvaluationParseResult } from "../app/lib/courses/evaluation";
import { emptyCourseData } from "../app/lib/courses/schema";
import type { AssessmentKind, CourseData } from "../app/lib/courses/types";

export interface EvaluationCase {
  id: string;
  locale: "nl" | "en";
  about?: string;
  name: string;
  respondents: number;
  /** Ids `lo-1…`. */
  outcomes: string[];
  /** Ids `act-1…`. */
  activities: { title: string; week?: number }[];
  /** Ids `t-1…`. */
  assessments: { title: string; week?: number; kind: AssessmentKind }[];
  /** The survey, as the browser sends it: anonymised. */
  evaluation: string;
  /** Linked test analyses: the test's number (1-based) and the analysis as text. */
  testAnalysis?: { test: number; analysis: string }[];
  context?: string;
  /** Words no part of the answer may contain: a person's name, an outlier, an injected instruction. */
  forbid?: string[];
  /** Places at least one problem or improvement must be on. */
  expectPlaces?: string[];
  /** The test a problem with basis `data` must be on. */
  expectDataAt?: string;
}

export interface EvaluationScore {
  caseId: string;
  parse: boolean;
  themes: number;
  improvements: number;
  /** Three to five improvements. */
  countOk: boolean;
  placesOk: boolean;
  dataOk: boolean;
  forbidden: number;
  /** Quotes and items the code dropped (not literally in the survey, one student, malformed). */
  dropped: number;
  pass: boolean;
}

/** The course of a case. */
export function caseCourse(c: EvaluationCase): CourseData {
  return {
    ...emptyCourseData(),
    outcomes: c.outcomes.map((text, i) => ({ id: `lo-${i + 1}`, text })),
    activities: c.activities.map((a, i) => ({
      id: `act-${i + 1}`,
      title: a.title,
      kind: "lesson",
      outcomeIds: [],
      ...(a.week ? { week: a.week } : {}),
    })),
    assessments: c.assessments.map((a, i) => ({
      id: `t-${i + 1}`,
      title: a.title,
      kind: a.kind,
      coverage: [],
      ...(a.week ? { week: a.week } : {}),
    })),
  };
}

/** The test analyses of a case, as the server builds them. */
export function caseTestAnalysis(c: EvaluationCase) {
  return (c.testAnalysis ?? []).map((t) => ({
    title: c.assessments[t.test - 1]?.title ?? "",
    analysis: t.analysis,
  }));
}

export function scoreEvaluationCase(
  c: EvaluationCase,
  r: EvaluationParseResult,
): EvaluationScore {
  if (!r.ok)
    return {
      caseId: c.id,
      parse: false,
      themes: 0,
      improvements: 0,
      countOk: false,
      placesOk: false,
      dataOk: false,
      forbidden: 0,
      dropped: 0,
      pass: false,
    };
  const { themes, problems, improvements } = r.evaluation;
  const placed = new Set(
    [...problems, ...improvements].flatMap((p) => (p.place.kind === "course" ? [] : [p.place.id])),
  );
  const placesOk = (c.expectPlaces ?? []).every((id) => placed.has(id));
  const dataOk =
    !c.expectDataAt ||
    problems.some(
      (p) => p.basis === "data" && p.place.kind === "assessment" && p.place.id === c.expectDataAt,
    );
  // Counted on what the teacher would see, after the checks in code.
  const shown = JSON.stringify(r.evaluation).toLowerCase();
  const forbidden = (c.forbid ?? []).filter((w) => shown.includes(w.toLowerCase())).length;
  const countOk = improvements.length >= 3 && improvements.length <= 5;
  return {
    caseId: c.id,
    parse: true,
    themes: themes.length,
    improvements: improvements.length,
    countOk,
    placesOk,
    dataOk,
    forbidden,
    dropped: r.dropped,
    pass: countOk && placesOk && dataOk && forbidden === 0,
  };
}

export function evaluationReportMarkdown(input: {
  date: string;
  model: string;
  repeat: number;
  rows: EvaluationScore[];
  /** Runs whose first answer was unreadable and got the app's one retry. */
  retries?: number;
}): string {
  const yesNo = (b: boolean) => (b ? "ja" : "nee");
  return [
    `# Eval cursusevaluatie verwerken — ${input.date}`,
    "",
    `Model: ${input.model}. Herhalingen per case: ${input.repeat}. Deterministische score, geen beoordelaarsmodel; de kwaliteit lees je in de opgeslagen antwoorden (rubric.md).`,
    "",
    "| Case | Geldig JSON | Thema's | Verbeterpunten | 3–5 | Plekken ok | Toetsdata ok | Verboden | Weggevallen | Geslaagd |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...input.rows.map(
      (r) =>
        `| ${r.caseId} | ${yesNo(r.parse)} | ${r.themes} | ${r.improvements} | ${yesNo(r.countOk)} | ${yesNo(r.placesOk)} | ${yesNo(r.dataOk)} | ${r.forbidden} | ${r.dropped} | ${yesNo(r.pass)} |`,
    ),
    "",
    `Geslaagd: ${input.rows.filter((r) => r.pass).length} van ${input.rows.length}. Herkansingen (onleesbaar JSON, zoals de app één keer opnieuw vraagt): ${input.retries ?? 0}.`,
    "",
  ].join("\n");
}
