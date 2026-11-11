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
import {
  type ImportAssessment,
  type ImportOutcome,
  type ImportProposal,
  weightsOff,
} from "./import";
import { COURSE_LIMITS } from "./schema";
import { ASSESSMENT_KINDS, type AssessmentKind, type CourseData } from "./types";

export const DESIGN_ASSESSMENTS_LIMITS = {
  /** The school's own assessment forms, as the teacher types them. */
  forms: 500,
  /** What the teacher wants changed in a new proposal. */
  remark: 500,
  /** The earlier proposal, as the review form sends it back. */
  previous: 8_000,
  /** A test programme of a course; more is a list of exercises. */
  assessments: 8,
  notes: 2_000,
};

/** Step 2 follows step 1: the course has outcomes and no tests yet. */
export const canDesignAssessments = (d: CourseData): boolean =>
  d.outcomes.length > 0 && d.assessments.length === 0;

// ── What the teacher gives ──────────────────────────────────────────────────

/** One test of an earlier proposal, in the shape of the model's answer. */
export interface PreviousTest {
  title: string;
  kind?: string | null;
  week?: number | null;
  weight?: number | null;
  outcomeRefs?: number[] | null;
  form?: string | null;
}

export interface AssessmentsBrief {
  forms?: string;
  /** "Ask again with a remark": what the teacher wants changed in `previous`. */
  remark?: string;
  /** The proposal the remark is about; only sent along with a remark. */
  previous?: PreviousTest[];
}

const RawTest = z.object({
  title: z.string(),
  kind: z.string().nullish(),
  week: z.number().nullish(),
  weight: z.number().nullish(),
  outcomeRefs: z.array(z.number()).nullish(),
  form: z.string().nullish(),
});

/** An earlier proposal, back as the hidden field the step 2 form sends with a remark. */
export function previousProposal(p: ImportProposal): PreviousTest[] {
  const n = new Map(p.outcomes.map((o, i) => [o.key, i + 1]));
  return p.assessments.map((a) => ({
    title: a.title,
    kind: a.kind ?? null,
    week: a.week ?? null,
    weight: a.weight ?? null,
    outcomeRefs: a.outcomeKeys.flatMap((k) => n.get(k) ?? []),
    form: a.details.form ?? null,
  }));
}

/** The earlier proposal is untrusted input like the rest: checked, cut and capped. */
function parsePrevious(json: string): PreviousTest[] | null {
  if (json.length > DESIGN_ASSESSMENTS_LIMITS.previous) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  const parsed = z.array(RawTest).safeParse(raw);
  if (!parsed.success) return null;
  // One line per test in the message: no line breaks from the form, no kind it does not know.
  const line = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, COURSE_LIMITS.title);
  return parsed.data.slice(0, DESIGN_ASSESSMENTS_LIMITS.assessments).map((t) => ({
    ...t,
    title: line(t.title),
    ...(t.kind !== undefined
      ? { kind: ASSESSMENT_KINDS.includes(t.kind as AssessmentKind) ? t.kind : null }
      : {}),
    ...(t.form ? { form: line(t.form) } : {}),
  }));
}

/** The step 2 form, checked again on the server; `null` for anything off. */
export function parseAssessmentsBrief(fd: FormData): AssessmentsBrief | null {
  const text = (name: string) => {
    const v = fd.get(name);
    return typeof v === "string" ? v.trim() : "";
  };
  const forms = text("forms");
  const remark = text("remark");
  if (forms.length > DESIGN_ASSESSMENTS_LIMITS.forms) return null;
  if (remark.length > DESIGN_ASSESSMENTS_LIMITS.remark) return null;
  const brief: AssessmentsBrief = forms ? { forms } : {};
  if (!remark) return brief;
  const json = text("previous");
  const previous = json ? parsePrevious(json) : [];
  if (!previous) return null;
  return { ...brief, remark, ...(previous.length ? { previous } : {}) };
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

/** An earlier proposal, one line per test, numbered as the answer refers to tests. */
function previousLines(tests: PreviousTest[]): string {
  return tests
    .map((t, i) =>
      [
        `${i + 1}. ${t.title}`,
        t.kind,
        typeof t.week === "number" ? `week ${t.week}` : null,
        typeof t.weight === "number" ? `weight ${t.weight}` : null,
        t.outcomeRefs?.length ? `outcomes ${t.outcomeRefs.join(", ")}` : null,
        t.form ? `form: ${t.form}` : null,
      ]
        .filter(Boolean)
        .join(" | "),
    )
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
  const { previous, remark } = input.brief;
  if (previous?.length)
    parts.push(
      wrapAsData("previousProposal", previousLines(previous), DESIGN_ASSESSMENTS_LIMITS.previous),
    );
  if (remark) parts.push(wrapAsData("remark", remark, DESIGN_ASSESSMENTS_LIMITS.remark));
  return parts.join("\n\n");
}

// ── Checking the answer ─────────────────────────────────────────────────────

const RawAssessments = z.object({
  assessments: z.array(RawTest),
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
