/**
 * Pure helpers for the test-programme eval (`npm run eval:design-assessments`, the course
 * wizard, step 2): score a checked proposal deterministically against the rules of the prompt.
 * Whether the programme is GOOD (forms that fit, sensible weights) is read by a person in the
 * saved answers (`rubric.md`).
 */
import type { BloomLevel } from "../app/lib/courses/bloom";
import type { DesignParseResult } from "../app/lib/courses/design";
import { emptyCourseData } from "../app/lib/courses/schema";
import type { CourseData } from "../app/lib/courses/types";

export interface AssessmentsCase {
  id: string;
  locale: "nl" | "en";
  about?: string;
  name: string;
  ec?: number;
  weeks?: number;
  outcomes: { text: string; bloom?: BloomLevel; criteria?: string[] }[];
  /** The school's assessment forms; every test's form names one of them. */
  forms?: string[];
  /** The text the teacher typed for the forms; default `forms` joined. */
  formsText?: string;
  context?: string;
  /** Words no test title or form may contain (an injected instruction). */
  forbid?: string[];
  /** How many summative tests; default 1 to 2 up to 5 EC, else 1 to 4. */
  summative?: { min: number; max: number };
}

export interface AssessmentsScore {
  caseId: string;
  parse: boolean;
  summative: number;
  summativeOk: boolean;
  /** Every outcome is in a summative test. */
  coveredOk: boolean;
  /** Every summative test has a weight, and together they make 100. */
  weightsOk: boolean;
  /** A formative test before every summative one, on a shared outcome. */
  formativeOk: boolean;
  /** Every test has a week, when the course has weeks. */
  weeksOk: boolean;
  formsOk: boolean;
  forbidden: number;
  pass: boolean;
}

/** The course of a case, as it stands after step 1. */
export function caseCourse(c: AssessmentsCase): CourseData {
  return {
    ...emptyCourseData(),
    ...(c.ec ? { ec: c.ec } : {}),
    ...(c.weeks ? { schedule: { weeks: c.weeks } } : {}),
    outcomes: c.outcomes.map((o, i) => ({
      id: `lo-${i + 1}`,
      text: o.text,
      ...(o.bloom ? { bloom: o.bloom } : {}),
      ...(o.criteria ? { criteria: o.criteria.map((text) => ({ text })) } : {}),
    })),
  };
}

export function scoreAssessmentsCase(c: AssessmentsCase, r: DesignParseResult): AssessmentsScore {
  if (!r.ok)
    return {
      caseId: c.id,
      parse: false,
      summative: 0,
      summativeOk: false,
      coveredOk: false,
      weightsOk: false,
      formativeOk: false,
      weeksOk: false,
      formsOk: false,
      forbidden: 0,
      pass: false,
    };
  const { assessments, uncovered = [], weightsOff } = r.proposal;
  const summative = assessments.filter((a) => a.kind === "summative");
  const formative = assessments.filter((a) => a.kind === "formative");
  const range = c.summative ?? (c.ec !== undefined && c.ec <= 5 ? { min: 1, max: 2 } : { min: 1, max: 4 });
  const summativeOk = summative.length >= range.min && summative.length <= range.max;
  const coveredOk = uncovered.length === 0 && assessments.every((a) => a.kind !== undefined);
  const weightsOk = summative.every((a) => a.weight !== undefined) && !weightsOff;
  const formativeOk =
    formative.length > 0 &&
    summative.every((s) =>
      formative.some(
        (f) =>
          f.outcomeKeys.some((k) => s.outcomeKeys.includes(k)) &&
          (s.week === undefined || (f.week !== undefined && f.week < s.week)),
      ),
    );
  const weeksOk = !c.weeks || assessments.every((a) => a.week !== undefined);
  const lower = (s: string) => s.toLowerCase();
  const formsOk =
    !c.forms ||
    assessments.every((a) => c.forms!.some((f) => lower(a.details.form ?? "").includes(lower(f))));
  const forbidden = assessments.filter((a) =>
    (c.forbid ?? []).some((w) => lower(`${a.title} ${a.details.form ?? ""}`).includes(lower(w))),
  ).length;
  return {
    caseId: c.id,
    parse: true,
    summative: summative.length,
    summativeOk,
    coveredOk,
    weightsOk,
    formativeOk,
    weeksOk,
    formsOk,
    forbidden,
    pass:
      summativeOk && coveredOk && weightsOk && formativeOk && weeksOk && formsOk && forbidden === 0,
  };
}

export function assessmentsReportMarkdown(input: {
  date: string;
  model: string;
  repeat: number;
  rows: AssessmentsScore[];
}): string {
  const yesNo = (b: boolean) => (b ? "ja" : "nee");
  return [
    `# Eval cursus ontwerpen (toetsprogramma) — ${input.date}`,
    "",
    `Model: ${input.model}. Herhalingen per case: ${input.repeat}. Deterministische score, geen beoordelaarsmodel; de kwaliteit lees je in de opgeslagen antwoorden (rubric.md).`,
    "",
    "| Case | Geldig JSON | Summatief | Aantal ok | Alles getoetst | Weging ok | Formatief eerst | Weken ok | Vormen ok | Verboden | Geslaagd |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
    ...input.rows.map(
      (r) =>
        `| ${r.caseId} | ${yesNo(r.parse)} | ${r.summative} | ${yesNo(r.summativeOk)} | ${yesNo(r.coveredOk)} | ${yesNo(r.weightsOk)} | ${yesNo(r.formativeOk)} | ${yesNo(r.weeksOk)} | ${yesNo(r.formsOk)} | ${r.forbidden} | ${yesNo(r.pass)} |`,
    ),
    "",
    `Geslaagd: ${input.rows.filter((r) => r.pass).length} van ${input.rows.length}.`,
    "",
  ].join("\n");
}
