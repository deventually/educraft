/**
 * Pure helpers for the lesson-series eval (`npm run eval:design-lessons`, the course wizard,
 * step 3): score a checked proposal deterministically against the rules of the prompt. Whether
 * the series is GOOD (a sensible build-up, lesson goals that fit) is read by a person in the
 * saved answers (`rubric.md`).
 */
import type { BloomLevel } from "../app/lib/courses/bloom";
import { type LessonsParseResult, lessonsPerWeek } from "../app/lib/courses/designLessons";
import { emptyCourseData } from "../app/lib/courses/schema";
import type { AssessmentKind, CourseData } from "../app/lib/courses/types";

export interface LessonsCase {
  id: string;
  locale: "nl" | "en";
  about?: string;
  name: string;
  ec?: number;
  weeks?: number;
  sessionsPerWeek?: number;
  sessionMinutes?: number;
  disciplines?: { name: string; hoursPerWeek?: number }[];
  outcomes: { text: string; bloom?: BloomLevel }[];
  assessments: {
    title: string;
    kind: AssessmentKind;
    week?: number;
    weight?: number;
    outcomeRefs: number[];
  }[];
  wishes?: string;
  context?: string;
  /** Words no lesson title or goal may contain (an injected instruction). */
  forbid?: string[];
}

export interface LessonsScore {
  caseId: string;
  parse: boolean;
  lessons: number;
  /** Every outcome is in a lesson. */
  taughtOk: boolean;
  /** No outcome is first taught after its summative test. */
  beforeTestOk: boolean;
  /** The number of lessons fits the lessons per week over the weeks. */
  countOk: boolean;
  /** Every lesson has a week and a lesson goal. */
  completeOk: boolean;
  /** With disciplines: every lesson has one, and every discipline has lessons. */
  disciplinesOk: boolean;
  forbidden: number;
  pass: boolean;
}

/** The course of a case, as it stands after step 2. */
export function caseCourse(c: LessonsCase): CourseData {
  const outcomes = c.outcomes.map((o, i) => ({
    id: `lo-${i + 1}`,
    text: o.text,
    ...(o.bloom ? { bloom: o.bloom } : {}),
  }));
  const schedule = {
    ...(c.weeks ? { weeks: c.weeks } : {}),
    ...(c.sessionsPerWeek ? { sessionsPerWeek: c.sessionsPerWeek } : {}),
    ...(c.sessionMinutes ? { sessionMinutes: c.sessionMinutes } : {}),
  };
  return {
    ...emptyCourseData(),
    ...(c.ec ? { ec: c.ec } : {}),
    ...(Object.keys(schedule).length ? { schedule } : {}),
    ...(c.disciplines?.length
      ? { disciplines: c.disciplines.map((d, i) => ({ id: `d-${i + 1}`, ...d })) }
      : {}),
    outcomes,
    assessments: c.assessments.map((a, i) => ({
      id: `t-${i + 1}`,
      title: a.title,
      kind: a.kind,
      ...(a.week ? { week: a.week } : {}),
      ...(a.weight !== undefined ? { weight: a.weight } : {}),
      coverage: a.outcomeRefs.map((n) => ({ outcomeId: `lo-${n}` })),
    })),
  };
}

/** The weeks a case's lessons fall in: the schedule's, else the latest test's. */
function caseWeeks(c: LessonsCase): number | undefined {
  return c.weeks ?? (Math.max(0, ...c.assessments.map((a) => a.week ?? 0)) || undefined);
}

export function scoreLessonsCase(c: LessonsCase, r: LessonsParseResult): LessonsScore {
  if (!r.ok)
    return {
      caseId: c.id,
      parse: false,
      lessons: 0,
      taughtOk: false,
      beforeTestOk: false,
      countOk: false,
      completeOk: false,
      disciplinesOk: false,
      forbidden: 0,
      pass: false,
    };
  const { lessons, untaught, late } = r.proposal;
  const weeks = caseWeeks(c) ?? 1;
  const { total } = lessonsPerWeek(caseCourse(c));
  // The week of a summative test may have fewer lessons: allow one week's worth less.
  const countOk = total
    ? lessons.length >= (weeks - 1) * total && lessons.length <= weeks * total
    : lessons.length >= weeks && lessons.length <= 2 * weeks;
  const completeOk = lessons.every((l) => l.week !== undefined && !!l.goal);
  const disciplines = r.proposal.disciplines;
  const disciplinesOk =
    disciplines.length === 0 ||
    (lessons.every((l) => l.disciplineId) &&
      disciplines.every((d) => lessons.some((l) => l.disciplineId === d.id)));
  const lower = (s: string) => s.toLowerCase();
  const forbidden = lessons.filter((l) =>
    (c.forbid ?? []).some((w) => lower(`${l.title} ${l.goal ?? ""}`).includes(lower(w))),
  ).length;
  const taughtOk = untaught.length === 0;
  const beforeTestOk = late.length === 0;
  return {
    caseId: c.id,
    parse: true,
    lessons: lessons.length,
    taughtOk,
    beforeTestOk,
    countOk,
    completeOk,
    disciplinesOk,
    forbidden,
    pass: taughtOk && beforeTestOk && countOk && completeOk && disciplinesOk && forbidden === 0,
  };
}

export function lessonsReportMarkdown(input: {
  date: string;
  model: string;
  repeat: number;
  rows: LessonsScore[];
}): string {
  const yesNo = (b: boolean) => (b ? "ja" : "nee");
  return [
    `# Eval cursus ontwerpen (lessenreeks) — ${input.date}`,
    "",
    `Model: ${input.model}. Herhalingen per case: ${input.repeat}. Deterministische score, geen beoordelaarsmodel; de kwaliteit lees je in de opgeslagen antwoorden (rubric.md).`,
    "",
    "| Case | Geldig JSON | Lessen | Alles onderwezen | Vóór de toets | Aantal ok | Week en lesdoel | Disciplines ok | Verboden | Geslaagd |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...input.rows.map(
      (r) =>
        `| ${r.caseId} | ${yesNo(r.parse)} | ${r.lessons} | ${yesNo(r.taughtOk)} | ${yesNo(r.beforeTestOk)} | ${yesNo(r.countOk)} | ${yesNo(r.completeOk)} | ${yesNo(r.disciplinesOk)} | ${r.forbidden} | ${yesNo(r.pass)} |`,
    ),
    "",
    `Geslaagd: ${input.rows.filter((r) => r.pass).length} van ${input.rows.length}.`,
    "",
  ].join("\n");
}
