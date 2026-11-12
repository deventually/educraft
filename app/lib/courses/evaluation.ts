/**
 * Processing a course evaluation (brief P33.2), the pure half: what the model gets to see, and
 * how its answer is checked before a teacher sees it. No server, no provider:
 * `app/server/courseEvaluation.server.ts` does the call.
 *
 * The evaluation is already anonymised in the browser (`app/lib/privacy/redact.ts`); the number
 * of respondents is counted in code, never by the model. Anti-fabrication lives here:
 * - a quote must be literally in the evaluation (modulo whitespace, quote style and case); the
 *   kept quote is the evaluation's own text;
 * - a theme that came up only once is no theme; a count never exceeds the respondents;
 * - a place the course does not have becomes the whole course;
 * - at most five improvements; unknown keys and malformed items are dropped.
 * Advice only: nothing here changes the course.
 */
import { z } from "zod";
import { extractJson, wrapAsData } from "~/lib/ai/structuredAnswer";
import { locateQuote } from "~/lib/portfolio/proofread";
import { improvementPlace } from "./improvements";
import { COURSE_LIMITS } from "./schema";
import type { CourseData, ImprovementPlace } from "./types";

export const EVALUATION_LIMITS = {
  /** Characters of anonymised evaluation text sent to the model. */
  evaluation: 40_000,
  respondents: 10_000,
  /** Below this many respondents the result is read with care (brief, rule 5). */
  smallGroup: 10,
  themes: 8,
  quotes: 3,
  quote: 400,
  label: 120,
  problems: 8,
  improvements: 5,
  text: COURSE_LIMITS.text,
  /** Characters of one linked test analysis. */
  testAnalysis: 4_000,
} as const;

const POLARITIES = ["positive", "negative"] as const;
const BASES = ["students", "data", "question"] as const;

interface EvaluationTheme {
  label: string;
  polarity: (typeof POLARITIES)[number];
  count: number;
  quotes: string[];
}

interface EvaluationProblem {
  place: ImprovementPlace;
  text: string;
  /** What it rests on: what students said, the test data, or an open question for the teacher. */
  basis: (typeof BASES)[number];
}

interface EvaluationImprovement {
  place: ImprovementPlace;
  text: string;
}

export interface CourseEvaluation {
  respondents: number;
  small: boolean;
  themes: EvaluationTheme[];
  problems: EvaluationProblem[];
  improvements: EvaluationImprovement[];
}

/** Every outcome, lesson and test with its id: the places the model may use. */
export function courseOutline(d: CourseData): string {
  const week = (w?: number, extra?: string) => {
    const parts = [w ? `week ${w}` : null, extra ?? null].filter(Boolean);
    return parts.length ? ` (${parts.join(", ")})` : "";
  };
  return [
    "Outcomes:",
    ...d.outcomes.map((o) => `- [${o.id}] ${o.text}`),
    "Lessons and assignments:",
    ...d.activities.map((a) => `- [${a.id}] ${a.title}${week(a.week)}`),
    "Tests:",
    ...d.assessments.map((a) => `- [${a.id}] ${a.title}${week(a.week, a.kind)}`),
  ].join("\n");
}

/** The user message. Everything from the teacher and the students is data, never instruction. */
export function buildEvaluationMessage(input: {
  name: string;
  data: CourseData;
  evaluation: string;
  respondents: number;
  /** Linked test analyses, each with its test's title and the analysis as text. */
  testAnalysis?: { title: string; analysis: string }[];
  /** The course's context profile, as `formatProfile` writes it; "" for none. */
  context: string;
}): string {
  const parts = [
    `<course>${input.name.trim().slice(0, COURSE_LIMITS.title)}</course>`,
    `<respondents>${input.respondents}</respondents>`,
    wrapAsData("outline", courseOutline(input.data)),
    wrapAsData("evaluation", input.evaluation.trim(), EVALUATION_LIMITS.evaluation),
  ];
  if (input.testAnalysis?.length)
    parts.push(
      wrapAsData(
        "testAnalysis",
        input.testAnalysis
          .map(
            (t) => `## ${t.title}\n${t.analysis.trim().slice(0, EVALUATION_LIMITS.testAnalysis)}`,
          )
          .join("\n\n"),
      ),
    );
  if (input.context.trim()) parts.push(wrapAsData("context", input.context.trim()));
  return parts.join("\n\n");
}

// ── Checking the answer ─────────────────────────────────────────────────────

const RawAnswer = z.object({
  themes: z.array(z.unknown()).default([]),
  problems: z.array(z.unknown()).default([]),
  improvements: z.array(z.unknown()).default([]),
});
const RawTheme = z.object({
  label: z.string().trim().min(1),
  polarity: z.enum(POLARITIES),
  count: z.number().int(),
  quotes: z.array(z.unknown()).default([]),
});
const RawProblem = z.object({
  place: z.string(),
  text: z.string().trim().min(1),
  basis: z.enum(BASES),
});
const RawImprovement = z.object({ place: z.string(), text: z.string().trim().min(1) });

/** A place by id: the course knows its kind; an unknown id is the whole course. */
function placeOf(d: CourseData, id: string): ImprovementPlace {
  const kind = d.outcomes.some((o) => o.id === id)
    ? "outcome"
    : d.activities.some((a) => a.id === id)
      ? "activity"
      : d.assessments.some((a) => a.id === id)
        ? "assessment"
        : null;
  return kind ? improvementPlace(d, { kind, id }) : { kind: "course" };
}

export type EvaluationParseResult =
  | { ok: true; evaluation: CourseEvaluation; dropped: number }
  | { ok: false; error: "unparseable" };

/** Checks and maps a raw model answer. Never throws. */
export function parseEvaluation(
  raw: string,
  ctx: { data: CourseData; evaluation: string; respondents: number },
): EvaluationParseResult {
  const parsed = RawAnswer.safeParse(extractJson(raw));
  if (!parsed.success) return { ok: false, error: "unparseable" };
  const L = EVALUATION_LIMITS;
  const text = (s: string) => s.slice(0, L.text);
  let dropped = 0;

  const themes: EvaluationTheme[] = [];
  for (const item of parsed.data.themes) {
    const t = RawTheme.safeParse(item);
    if (!t.success || t.data.count < 2) {
      dropped++;
      continue;
    }
    const quotes: string[] = [];
    for (const q of t.data.quotes) {
      const own = typeof q === "string" ? locateQuote(q, ctx.evaluation) : null;
      if (!own || own.length > L.quote || quotes.includes(own)) dropped++;
      else quotes.push(own);
    }
    themes.push({
      label: t.data.label.slice(0, L.label),
      polarity: t.data.polarity,
      count: Math.min(t.data.count, ctx.respondents),
      quotes: quotes.slice(0, L.quotes),
    });
  }

  const problems: EvaluationProblem[] = [];
  for (const item of parsed.data.problems) {
    const p = RawProblem.safeParse(item);
    if (!p.success) dropped++;
    else
      problems.push({
        place: placeOf(ctx.data, p.data.place),
        text: text(p.data.text),
        basis: p.data.basis,
      });
  }

  const improvements: EvaluationImprovement[] = [];
  for (const item of parsed.data.improvements) {
    const p = RawImprovement.safeParse(item);
    if (!p.success) dropped++;
    else improvements.push({ place: placeOf(ctx.data, p.data.place), text: text(p.data.text) });
  }

  return {
    ok: true,
    dropped,
    evaluation: {
      respondents: ctx.respondents,
      small: ctx.respondents < L.smallGroup,
      themes: themes.slice(0, L.themes),
      problems: problems.slice(0, L.problems),
      improvements: improvements.slice(0, L.improvements),
    },
  };
}
