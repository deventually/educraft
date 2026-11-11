/**
 * What the course import reads beyond outcomes and assessments: what a test blueprint
 * (toetsmatrijs), a marking model (nakijkmodel) and a module guide or handbook hold. The module
 * details (code, study year, phase, leader, examiners, description, literature),
 * success criteria per outcome, the details of a test and its parts. Pure: the model's answer
 * is checked and clipped here, the teacher's choice is read here, and applying it only fills
 * in what the course does not have yet. Nothing that is filled in is ever changed.
 */
import { z } from "zod";
import { verbatimIn } from "~/lib/ai/structuredAnswer";
import * as edit from "./edit";
import { COURSE_LIMITS } from "./schema";
import {
  type Assessment,
  type AssessmentPart,
  type CourseData,
  GRADINGS,
  type Grading,
  type SuccessCriterion,
} from "./types";

// ── The model's answer ──────────────────────────────────────────────────────

const str = z.string().nullish();
const num = z.number().nullish();

export const RawModule = z
  .object({
    code: str,
    studyYear: str,
    phase: str,
    leader: str,
    examiners: str,
    description: str,
    literature: str,
  })
  .nullish();
export const RawCriteria = z.array(z.object({ code: str, text: z.string() })).nullish();
export const rawAssessmentExtras = {
  form: str,
  owner: str,
  grading: str,
  passMark: num,
  conditions: z.array(z.string()).nullish(),
  resit: str,
  conduct: str,
  parts: z
    .array(
      z.object({
        title: z.string(),
        outcomeRefs: z.array(z.number()).nullish(),
        weight: num,
        knockOut: z.boolean().nullish(),
        pass: str,
        fail: str,
      }),
    )
    .nullish(),
};
const RawAssessmentExtras = z.object(rawAssessmentExtras);
type RawExtras = z.infer<typeof RawAssessmentExtras>;

/** Clipping to the course limits; the caller reports that something was cut off. */
export interface Clip {
  cut: (s: string, max: number) => string;
  take: <T>(items: T[], max: number) => T[];
}

export interface ImportModule {
  code?: string;
  studyYear?: string;
  phase?: string;
  leader?: string;
  examiners?: string;
  description?: string;
  literature?: string;
}

/** Each module field with its limit; the module guide and handbook fields came in v3. */
const MODULE_FIELDS = {
  code: COURSE_LIMITS.code,
  studyYear: COURSE_LIMITS.code,
  phase: COURSE_LIMITS.title,
  leader: COURSE_LIMITS.title,
  examiners: COURSE_LIMITS.title,
  description: COURSE_LIMITS.longText,
  literature: COURSE_LIMITS.longText,
} as const satisfies Record<keyof ImportModule, number>;
const moduleKeys = Object.keys(MODULE_FIELDS) as (keyof ImportModule)[];

export interface ImportCriterion extends SuccessCriterion {
  /** The text is in the document (modulo layout); otherwise "check this". */
  verbatim: boolean;
}

export interface ImportDetails {
  form?: string;
  owner?: string;
  grading?: Grading;
  passMark?: number;
  conditions?: string[];
  resit?: string;
  conduct?: string;
}

export interface ImportPart {
  title: string;
  outcomeKeys: string[];
  weight?: number;
  knockOut?: true;
  pass?: string;
  fail?: string;
  /** Its criteria for a pass and a fail are in the document. */
  verbatim: boolean;
}

const optional = (clip: Clip, s: string | null | undefined, max: number) => {
  const v = clip.cut(s ?? "", max);
  return v ? v : undefined;
};
const percent = (n: number | null | undefined) =>
  typeof n === "number" && n >= 0 && n <= 100 ? n : undefined;
/** Drops the keys whose value is undefined, so a proposal holds only what was found. */
const defined = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

export function proposeModule(
  raw: z.infer<typeof RawModule>,
  clip: Clip,
): ImportModule | undefined {
  const m: ImportModule = defined(
    Object.fromEntries(
      moduleKeys.map((k) => [k, optional(clip, raw?.[k]?.trim(), MODULE_FIELDS[k])]),
    ),
  );
  return Object.keys(m).length ? m : undefined;
}

export function proposeCriteria(
  raw: z.infer<typeof RawCriteria>,
  clip: Clip,
  source: string,
): ImportCriterion[] {
  return clip
    .take(
      (raw ?? []).filter((c) => c.text.trim()),
      COURSE_LIMITS.criteria,
    )
    .map((c) => {
      const text = clip.cut(c.text, COURSE_LIMITS.text);
      const code = optional(clip, c.code, COURSE_LIMITS.criterionCode);
      return { ...(code ? { code } : {}), text, verbatim: verbatimIn(text, source) };
    });
}

export function proposeDetails(raw: RawExtras, clip: Clip): ImportDetails {
  const conditions = clip
    .take(
      (raw.conditions ?? []).map((c) => clip.cut(c, COURSE_LIMITS.text)).filter(Boolean),
      COURSE_LIMITS.conditions,
    )
    .filter(Boolean);
  return defined({
    form: optional(clip, raw.form, COURSE_LIMITS.title),
    owner: optional(clip, raw.owner, COURSE_LIMITS.title),
    grading: GRADINGS.find((g) => g === raw.grading),
    passMark: percent(raw.passMark),
    conditions: conditions.length ? conditions : undefined,
    resit: optional(clip, raw.resit, COURSE_LIMITS.longText),
    conduct: optional(clip, raw.conduct, COURSE_LIMITS.longText),
  });
}

/** The parts of a test; a reference to an outcome that is not in the proposal is dropped. */
export function proposeParts(
  raw: RawExtras,
  clip: Clip,
  source: string,
  outcomeCount: number,
): ImportPart[] {
  return clip
    .take(
      (raw.parts ?? []).filter((p) => p.title.trim()),
      COURSE_LIMITS.parts,
    )
    .map((p) => {
      const pass = optional(clip, p.pass, COURSE_LIMITS.longText);
      const fail = optional(clip, p.fail, COURSE_LIMITS.longText);
      const refs = new Set((p.outcomeRefs ?? []).filter((n) => Number.isInteger(n)));
      return defined({
        title: clip.cut(p.title, COURSE_LIMITS.title),
        outcomeKeys: [...refs].filter((n) => n >= 1 && n <= outcomeCount).map((n) => `o${n}`),
        weight: percent(p.weight),
        knockOut: p.knockOut ? (true as const) : undefined,
        pass,
        fail,
        verbatim: [pass, fail].every((t) => !t || verbatimIn(t, source)),
      });
    });
}

// ── The teacher's choice ────────────────────────────────────────────────────

const Text = (max: number) => z.string().trim().min(1).max(max);
const Percent = z.number().min(0).max(100);
const OutcomeKey = z.string().regex(/^o\d{1,2}$/);

const OutcomeExtra = z.object({
  criteria: z
    .array(
      z.object({
        code: Text(COURSE_LIMITS.criterionCode).optional(),
        text: Text(COURSE_LIMITS.text),
      }),
    )
    .max(COURSE_LIMITS.criteria)
    .default([]),
});

const Details = z.object({
  form: Text(COURSE_LIMITS.title).optional(),
  owner: Text(COURSE_LIMITS.title).optional(),
  grading: z.enum(GRADINGS).optional(),
  passMark: Percent.optional(),
  conditions: z.array(Text(COURSE_LIMITS.text)).max(COURSE_LIMITS.conditions).optional(),
  resit: Text(COURSE_LIMITS.longText).optional(),
  conduct: Text(COURSE_LIMITS.longText).optional(),
});

const AssessmentExtra = z.object({
  details: Details.default({}),
  parts: z
    .array(
      z.object({
        title: Text(COURSE_LIMITS.title),
        outcomeKeys: z.array(OutcomeKey).max(COURSE_LIMITS.outcomes).default([]),
        weight: Percent.optional(),
        knockOut: z.literal(true).optional(),
        pass: Text(COURSE_LIMITS.longText).optional(),
        fail: Text(COURSE_LIMITS.longText).optional(),
      }),
    )
    .max(COURSE_LIMITS.parts)
    .default([]),
});

export type SelectedDetails = z.infer<typeof Details>;
export type SelectedPart = z.infer<typeof AssessmentExtra>["parts"][number];

/** A row's extra data, posted as JSON in `<key>.extra`; absent is empty. Throws when off. */
const extra = <S extends z.ZodType>(schema: S, value: string | undefined): z.infer<S> =>
  schema.parse(value ? JSON.parse(value) : {});

export const outcomeExtra = (value: string | undefined) => extra(OutcomeExtra, value).criteria;

/** The details and parts of a test; a part may point only at an outcome of the proposal. */
export function assessmentExtra(value: string | undefined, known: Set<string>) {
  const e = extra(AssessmentExtra, value);
  if (e.parts.some((p) => p.outcomeKeys.some((k) => !known.has(k))))
    throw new Error("unknown outcome key");
  return e;
}

/** The `module.<field>` fields, only when `module.pick` is ticked. Throws when one is off. */
export function moduleChoice(one: (name: string) => string | undefined, ticked: boolean) {
  if (!ticked) return undefined;
  const m: ImportModule = defined(
    Object.fromEntries(
      moduleKeys.map((k) => [
        k,
        Text(MODULE_FIELDS[k])
          .optional()
          .parse(one(`module.${k}`)?.trim() || undefined),
      ]),
    ),
  );
  return Object.keys(m).length ? m : undefined;
}

// ── Applying it: only what is empty ─────────────────────────────────────────

export function fillModule(d: CourseData, m: ImportModule | undefined): CourseData {
  if (!m) return d;
  return edit.setModule(
    d,
    Object.fromEntries(moduleKeys.map((k) => [k, d[k] ?? m[k]])) as ImportModule,
  );
}

export function fillCriteria(
  d: CourseData,
  outcomeId: string,
  criteria: SuccessCriterion[] | undefined,
): CourseData {
  const o = d.outcomes.find((x) => x.id === outcomeId);
  if (!o || o.criteria?.length || !criteria?.length) return d;
  return edit.updateOutcome(d, outcomeId, { criteria });
}

/** Fills the test's empty details and, when it has no parts yet, adds the parts. */
export function fillAssessment(
  d: CourseData,
  assessmentId: string,
  details: SelectedDetails | undefined,
  parts: SelectedPart[] | undefined,
  idByKey: Map<string, string>,
): CourseData {
  const a = d.assessments.find((x) => x.id === assessmentId);
  if (!a) return d;
  const patch = Object.fromEntries(
    Object.entries(details ?? {}).filter(([k]) => a[k as keyof Assessment] === undefined),
  ) as Partial<Assessment>;
  let next = Object.keys(patch).length ? edit.updateAssessment(d, assessmentId, patch) : d;
  if (a.parts?.length) return next;
  for (const p of parts ?? []) {
    const { outcomeKeys, ...rest } = p;
    const part: Omit<AssessmentPart, "id"> = {
      ...rest,
      outcomeIds: outcomeKeys.flatMap((k) => idByKey.get(k) ?? []),
    };
    next = edit.addPart(next, assessmentId, part);
  }
  return next;
}
