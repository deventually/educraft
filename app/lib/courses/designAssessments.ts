/**
 * Designing the test programme (the course wizard, step 2), the pure half: after the outcomes,
 * the AI proposes summative and formative tests with kind, week, weight, coverage and form.
 * The answer is an `ImportProposal` with `source: "design"` over the course's OWN outcomes, so
 * the teacher reviews it in the same form as an import and `import-apply` adds what is ticked.
 * Weights are a proposal: never corrected, only reported when they miss 100 (`weightsOff`), and
 * an outcome no summative test covers is named (`uncovered`). No server, no provider:
 * `app/server/courseDesign.server.ts` does the call.
 */
import { z } from "zod";
import { extractJson, wrapAsData } from "~/lib/ai/structuredAnswer";
import { normalizeForMatch } from "~/lib/documents/locate";
import type { DesignParseResult } from "./design";
import { type ImportAssessment, type ImportOutcome, weightsOff } from "./import";
import { COURSE_LIMITS } from "./schema";
import { ASSESSMENT_KINDS, type AssessmentKind, type CourseData } from "./types";

export const DESIGN_ASSESSMENTS_LIMITS = {
  /** The school's own assessment forms, as the teacher types them. */
  forms: 500,
  /** A test programme of a course; more is a list of exercises. */
  assessments: 8,
  notes: 2_000,
};

/** Step 2 follows step 1: the course has outcomes and no tests yet. */
export const canDesignAssessments = (d: CourseData): boolean =>
  d.outcomes.length > 0 && d.assessments.length === 0;

// ── What the teacher gives ──────────────────────────────────────────────────

export interface AssessmentsBrief {
  forms?: string;
}

/** The step 2 form, checked again on the server; `null` for anything off. */
export function parseAssessmentsBrief(fd: FormData): AssessmentsBrief | null {
  const v = fd.get("forms");
  const forms = typeof v === "string" ? v.trim() : "";
  if (forms.length > DESIGN_ASSESSMENTS_LIMITS.forms) return null;
  return forms ? { forms } : {};
}

// ── What the model sees ─────────────────────────────────────────────────────

/** The course's outcomes, numbered as the answer refers to them, with level and criteria. */
function outcomeLines(d: CourseData): string {
  return d.outcomes
    .map((o, i) => {
      const head = `${i + 1}. ${o.text}${o.bloom ? ` [${o.bloom}]` : ""}`;
      const criteria = (o.criteria ?? []).map((c) => `   - ${c.text}`);
      return [head, ...criteria].join("\n");
    })
    .join("\n");
}

export function buildAssessmentsDesignMessage(input: {
  name: string;
  data: CourseData;
  brief: AssessmentsBrief;
  /** The course's context profile, as `formatProfile` writes it; "" for none. */
  context: string;
}): string {
  const { data } = input;
  const parts = [`<course>${input.name.trim().slice(0, COURSE_LIMITS.title)}</course>`];
  if (data.ec) parts.push(`<studyLoad>${data.ec} EC</studyLoad>`);
  if (data.schedule?.weeks) parts.push(`<weeks>${data.schedule.weeks}</weeks>`);
  parts.push(wrapAsData("outcomes", outcomeLines(data)));
  if (input.brief.forms)
    parts.push(wrapAsData("assessmentForms", input.brief.forms, DESIGN_ASSESSMENTS_LIMITS.forms));
  if (input.context.trim()) parts.push(wrapAsData("context", input.context.trim()));
  return parts.join("\n\n");
}

// ── Checking the answer ─────────────────────────────────────────────────────

const RawAssessments = z.object({
  assessments: z.array(
    z.object({
      title: z.string(),
      kind: z.string().nullish(),
      week: z.number().nullish(),
      weight: z.number().nullish(),
      outcomeRefs: z.array(z.number()).nullish(),
      form: z.string().nullish(),
    }),
  ),
  notes: z.string().nullish(),
});

const comparable = (s: string) => normalizeForMatch(s).replace(/[.;:]$/, "");

/**
 * Parses and checks the model's test programme. Never throws. Coverage only points at the
 * course's outcomes, a week outside the course and a formative test's weight are left out,
 * empty and duplicate titles go, and the programme is cut to `DESIGN_ASSESSMENTS_LIMITS`.
 */
export function parseAssessmentsDesign(raw: string, course: CourseData): DesignParseResult {
  const parsed = RawAssessments.safeParse(extractJson(raw));
  if (!parsed.success) return { ok: false, error: "unparseable" };
  let clipped = false;
  const cut = (s: string, max: number) => {
    const t = s.trim();
    if (t.length > max) clipped = true;
    return t.slice(0, max);
  };

  // The course's own outcomes: carried along so the review form can link to them.
  const outcomes: ImportOutcome[] = course.outcomes.map((o, i) => ({
    key: `o${i + 1}`,
    text: o.text,
    ...(o.bloom ? { bloom: o.bloom } : {}),
    verbatim: false,
    existing: true,
    criteria: [],
  }));
  const lastWeek = course.schedule?.weeks ?? COURSE_LIMITS.week;
  const have = new Set(course.assessments.map((a) => comparable(a.title)));

  const seen = new Set<string>();
  const unique = parsed.data.assessments.filter((a) => {
    const k = comparable(a.title);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (unique.length > DESIGN_ASSESSMENTS_LIMITS.assessments) clipped = true;

  const assessments: ImportAssessment[] = unique
    .slice(0, DESIGN_ASSESSMENTS_LIMITS.assessments)
    .map((a, i) => {
      const title = cut(a.title, COURSE_LIMITS.title);
      const kind = ASSESSMENT_KINDS.includes(a.kind as AssessmentKind)
        ? (a.kind as AssessmentKind)
        : undefined;
      const week =
        typeof a.week === "number" && Number.isInteger(a.week) && a.week >= 1 && a.week <= lastWeek
          ? a.week
          : undefined;
      const weight =
        kind !== "formative" && typeof a.weight === "number" && a.weight >= 0 && a.weight <= 100
          ? a.weight
          : undefined;
      const refs = new Set(
        (a.outcomeRefs ?? []).filter((n) => Number.isInteger(n) && n >= 1 && n <= outcomes.length),
      );
      const form = a.form?.trim() ? cut(a.form, COURSE_LIMITS.title) : undefined;
      return {
        key: `a${i + 1}`,
        title,
        ...(kind ? { kind } : {}),
        ...(week !== undefined ? { week } : {}),
        ...(weight !== undefined ? { weight } : {}),
        outcomeKeys: [...refs].map((n) => `o${n}`),
        existing: have.has(comparable(title)),
        details: form ? { form } : {},
        parts: [],
      };
    });

  const notes = cut(parsed.data.notes ?? "", DESIGN_ASSESSMENTS_LIMITS.notes);
  if (assessments.length === 0) return { ok: false, error: "empty", ...(notes ? { notes } : {}) };
  const summative = assessments.filter((a) => a.kind !== "formative");
  const uncovered = outcomes
    .map((o) => o.key)
    .filter((k) => !summative.some((a) => a.outcomeKeys.includes(k)));
  return {
    ok: true,
    proposal: {
      source: "design",
      outcomes,
      assessments,
      ...(notes ? { notes } : {}),
      weightsOff: weightsOff(assessments),
      uncovered,
    },
    clipped,
  };
}
