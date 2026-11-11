/**
 * Importing learning outcomes and assessments from a document (brief P26, 26.3),
 * the pure half: what the model gets to see, how its answer is checked, how the
 * teacher's choice is read from the review form and applied. No server, no
 * provider: `app/server/courseImport.server.ts` does the call.
 *
 * The answer is a proposal, never stored as such: an outcome whose text is not
 * verbatim in the document (modulo layout) is marked, and only what the teacher
 * ticks is added. Re-importing adds only new items: an outcome or assessment the
 * course already has (same text, normalized) is never duplicated or overwritten,
 * only completed where it is empty (a marking model after a study guide).
 */
import { z } from "zod";
import { extractJson, verbatimIn, wrapAsData } from "~/lib/ai/structuredAnswer";
import { normalizeForMatch } from "~/lib/documents/locate";
import { BLOOM_LEVELS, type BloomLevel } from "./bloom";
import * as edit from "./edit";
import {
  assessmentExtra,
  type Clip,
  coverBlooms,
  fillAssessment,
  fillCriteria,
  fillModule,
  type ImportCriterion,
  type ImportDetails,
  type ImportModule,
  type ImportPart,
  moduleChoice,
  outcomeExtra,
  proposeCriteria,
  proposeDetails,
  proposeModule,
  proposeParts,
  RawCriteria,
  RawModule,
  rawAssessmentExtras,
  type SelectedDetails,
  type SelectedPart,
} from "./importExtras";
import { optionalNumber } from "./intentFields";
import { COURSE_LIMITS, CourseDataSchema } from "./schema";
import {
  ASSESSMENT_KINDS,
  type AssessmentKind,
  type CourseData,
  type SuccessCriterion,
} from "./types";

export interface ImportOutcome {
  key: string;
  text: string;
  /** The model's Bloom proposal; the teacher confirms it. */
  bloom?: BloomLevel;
  /** The text is in the document (modulo layout); otherwise "check this". */
  verbatim: boolean;
  /** The course already has this outcome; importing it only fills in empty criteria. */
  existing: boolean;
  /** Success criteria, from a test blueprint. */
  criteria: ImportCriterion[];
}

export interface ImportAssessment {
  key: string;
  title: string;
  kind?: AssessmentKind;
  weight?: number;
  week?: number;
  outcomeKeys: string[];
  existing: boolean;
  /** From a test blueprint or marking model: form, owner, pass mark, conditions, … */
  details: ImportDetails;
  parts: ImportPart[];
}

export interface ImportProposal {
  /**
   * "design": the AI proposed it from the teacher's description (`design.ts`), not from a
   * document. There is nothing to check it against, so the whole proposal is the AI's.
   */
  source?: "design";
  /** The module code and study year, when the document names them. */
  module?: ImportModule;
  outcomes: ImportOutcome[];
  assessments: ImportAssessment[];
  notes?: string;
  /** Some weights are given and they do not add up to 100. Reported, never corrected. */
  weightsOff: boolean;
  /** A designed test programme: the outcome keys no summative test covers. Reported, never fixed. */
  uncovered?: string[];
}

export type ImportParseResult =
  | { ok: true; proposal: ImportProposal; flagged: number; clipped: boolean }
  | { ok: false; error: "unparseable" }
  /** Valid answer, nothing to import; `notes` is the model's explanation, if any. */
  | { ok: false; error: "empty"; notes?: string };

const NOTES_MAX = 2_000;

/**
 * The largest document text the import takes (browser, server and model call).
 * A whole OER, Deel A plus Deel B, runs to ~180k characters and its course
 * tables come last, so the 80k structured-input default would cut them off.
 * 300k characters is ~100k tokens: within the default model's context.
 */
export const IMPORT_DOCUMENT_MAX = 300_000;

/** The user message: the document as data, and the course name to find the right part. */
export function buildImportMessage(documentText: string, courseName?: string): string {
  const name = courseName?.trim().slice(0, COURSE_LIMITS.title);
  const doc = wrapAsData("document", documentText, IMPORT_DOCUMENT_MAX);
  return name ? `<course>${name}</course>\n\n${doc}` : doc;
}

// ── Checking the answer ─────────────────────────────────────────────────────

const str = z.string().nullish();
const num = z.number().nullish();
const RawImport = z.object({
  module: RawModule,
  outcomes: z.array(z.object({ text: z.string(), bloomProposal: str, criteria: RawCriteria })),
  assessments: z
    .array(
      z.object({
        title: z.string(),
        kind: str,
        weight: num,
        week: num,
        outcomeRefs: z.array(z.number()).nullish(),
        ...rawAssessmentExtras,
      }),
    )
    .nullish(),
  notes: str,
});

/** The same outcome or assessment: equal modulo layout, case and a closing full stop. */
const comparable = (s: string) => normalizeForMatch(s).replace(/[.;:]$/, "");
const same = (a: string, b: string) => comparable(a) === comparable(b);
const oneOf = <T extends string>(list: readonly T[], v: unknown): T | undefined =>
  list.includes(v as T) ? (v as T) : undefined;
const inRange = (n: number | null | undefined, min: number, max: number, int: boolean) =>
  typeof n === "number" && n >= min && n <= max && (!int || Number.isInteger(n)) ? n : undefined;

/** Do the given weights miss 100? Only when at least one weight is given. */
export function weightsOff(assessments: ImportAssessment[]): boolean {
  const weights = assessments.filter((a) => a.kind !== "formative").map((a) => a.weight);
  const given = weights.filter((w): w is number => w !== undefined);
  if (given.length === 0) return false;
  return Math.abs(given.reduce((s, w) => s + w, 0) - 100) > 0.01;
}

/** Parses, clips to the course limits and checks a raw model answer. Never throws. */
export function parseImport(
  raw: string,
  documentText: string,
  course: CourseData,
): ImportParseResult {
  const parsed = RawImport.safeParse(extractJson(raw));
  if (!parsed.success) return { ok: false, error: "unparseable" };
  const r = parsed.data;
  let clipped = false;
  const cut = (s: string, max: number): string => {
    const t = s.trim();
    if (t.length > max) clipped = true;
    return t.slice(0, max);
  };
  const take = <T>(items: T[], max: number): T[] => {
    if (items.length > max) clipped = true;
    return items.slice(0, max);
  };
  const clip: Clip = { cut, take };

  const source = normalizeForMatch(documentText);
  let flagged = 0;
  const outcomes: ImportOutcome[] = take(
    r.outcomes.filter((o) => o.text.trim()),
    COURSE_LIMITS.outcomes,
  ).map((o, i) => {
    const text = cut(o.text, COURSE_LIMITS.text);
    const verbatim = verbatimIn(text, source);
    if (!verbatim) flagged++;
    const bloom = oneOf(BLOOM_LEVELS, o.bloomProposal);
    const criteria = proposeCriteria(o.criteria, clip, source);
    flagged += criteria.filter((c) => !c.verbatim).length;
    return {
      key: `o${i + 1}`,
      text,
      ...(bloom ? { bloom } : {}),
      verbatim,
      existing: course.outcomes.some((c) => same(c.text, text)),
      criteria,
    };
  });

  const assessments: ImportAssessment[] = take(
    (r.assessments ?? []).filter((a) => a.title.trim()),
    COURSE_LIMITS.assessments,
  ).map((a, i) => {
    const title = cut(a.title, COURSE_LIMITS.title);
    const kind = oneOf(ASSESSMENT_KINDS, a.kind);
    const weight = inRange(a.weight, 0, 100, false);
    const week = inRange(a.week, 1, COURSE_LIMITS.week, true);
    const refs = new Set((a.outcomeRefs ?? []).filter((n) => Number.isInteger(n)));
    const parts = proposeParts(a, clip, source, outcomes.length);
    flagged += parts.filter((p) => !p.verbatim).length;
    return {
      key: `a${i + 1}`,
      title,
      ...(kind ? { kind } : {}),
      ...(weight !== undefined ? { weight } : {}),
      ...(week !== undefined ? { week } : {}),
      outcomeKeys: [...refs].filter((n) => n >= 1 && n <= outcomes.length).map((n) => `o${n}`),
      existing: course.assessments.some((c) => same(c.title, title)),
      details: proposeDetails(a, clip),
      parts,
    };
  });

  const notes = cut(r.notes ?? "", NOTES_MAX);
  const module = proposeModule(r.module, clip);
  if (outcomes.length === 0 && assessments.length === 0)
    return { ok: false, error: "empty", ...(notes ? { notes } : {}) };
  return {
    ok: true,
    proposal: {
      ...(module ? { module } : {}),
      outcomes,
      assessments,
      ...(notes ? { notes } : {}),
      weightsOff: weightsOff(assessments),
    },
    flagged,
    clipped,
  };
}

// ── Reading the teacher's choice ────────────────────────────────────────────

export interface ImportSelection {
  module?: ImportModule;
  outcomes: {
    key: string;
    pick: boolean;
    text: string;
    bloom?: BloomLevel;
    criteria?: SuccessCriterion[];
  }[];
  assessments: {
    key: string;
    pick: boolean;
    title: string;
    kind: AssessmentKind;
    weight?: number;
    week?: number;
    outcomeKeys: string[];
    /** The Bloom level this test assesses a covered outcome at, by outcome key. */
    outcomeBlooms?: Partial<Record<string, BloomLevel>>;
    details?: SelectedDetails;
    parts?: SelectedPart[];
  }[];
}

const OutcomeKey = z.string().regex(/^o\d{1,2}$/);
const AssessmentKey = z.string().regex(/^a\d{1,2}$/);
const required = (max: number) => z.string().trim().min(1).max(max);
const bloomField = z
  .enum([...BLOOM_LEVELS, ""])
  .optional()
  .transform((v) => (v ? v : undefined));

/**
 * The review form: `outcomeKey` / `assessmentKey` list the rows, each row's
 * fields are `<key>.<field>`, a ticked row has `<key>.pick`. Every value is
 * checked again (the proposal is not stored, so the form is untrusted input).
 * `null` for anything off.
 */
export function parseImportSelection(fd: FormData): ImportSelection | null {
  const one = (name: string) => {
    const v = fd.get(name);
    return typeof v === "string" ? v : undefined;
  };
  const keys = (name: string) => fd.getAll(name).filter((v): v is string => typeof v === "string");
  try {
    const outcomeKeys = z.array(OutcomeKey).max(COURSE_LIMITS.outcomes).parse(keys("outcomeKey"));
    const assessmentKeys = z
      .array(AssessmentKey)
      .max(COURSE_LIMITS.assessments)
      .parse(keys("assessmentKey"));
    if (outcomeKeys.length + assessmentKeys.length === 0) return null;
    if (new Set(outcomeKeys).size !== outcomeKeys.length) return null;
    if (new Set(assessmentKeys).size !== assessmentKeys.length) return null;

    const outcomes = outcomeKeys.map((key) => {
      const bloom = bloomField.parse(one(`${key}.bloom`));
      const criteria = outcomeExtra(one(`${key}.extra`));
      return {
        key,
        pick: fd.has(`${key}.pick`),
        text: required(COURSE_LIMITS.text).parse(one(`${key}.text`)),
        ...(bloom ? { bloom } : {}),
        ...(criteria.length ? { criteria } : {}),
      };
    });
    const known = new Set(outcomeKeys);
    const assessments = assessmentKeys.map((key) => {
      const weight = optionalNumber(0, 100).parse(one(`${key}.weight`));
      const week = optionalNumber(1, COURSE_LIMITS.week, true).parse(one(`${key}.week`));
      const refs = z.array(OutcomeKey).parse(keys(`${key}.outcomes`));
      if (refs.some((r) => !known.has(r))) throw new Error("unknown outcome key");
      const { details, parts } = assessmentExtra(one(`${key}.extra`), known);
      const outcomeBlooms = coverBlooms(refs, (o) => bloomField.parse(one(`${key}.bloom.${o}`)));
      return {
        key,
        pick: fd.has(`${key}.pick`),
        title: required(COURSE_LIMITS.title).parse(one(`${key}.title`)),
        kind: z.enum(ASSESSMENT_KINDS).parse(one(`${key}.kind`)),
        ...(weight !== undefined ? { weight } : {}),
        ...(week !== undefined ? { week } : {}),
        outcomeKeys: [...new Set(refs)],
        ...(outcomeBlooms ? { outcomeBlooms } : {}),
        details,
        parts,
      };
    });
    const module = moduleChoice(one, fd.has("module.pick"));
    return { ...(module ? { module } : {}), outcomes, assessments };
  } catch {
    return null;
  }
}

// ── Applying the choice ─────────────────────────────────────────────────────

export type ApplyImportResult =
  | { ok: true; data: CourseData; added: { outcomes: number; assessments: number } }
  | { ok: false; error: "limit" | "invalid" };

/**
 * Adds the ticked outcomes and assessments through the pure edits. An outcome
 * the course already has is reused (an assessment's coverage points at it); a
 * ticked one only gets criteria when it has none. A ticked assessment with an
 * existing title is not added again: only its empty details are filled in, and
 * its parts when it has none (`importExtras.ts`). Nothing filled in changes.
 */
export function applyImport(d: CourseData, s: ImportSelection): ApplyImportResult {
  let next = fillModule(d, s.module);
  const idByKey = new Map<string, string>();
  let outcomes = 0;
  let assessments = 0;
  for (const o of s.outcomes) {
    const existing = next.outcomes.find((c) => same(c.text, o.text));
    if (existing) {
      idByKey.set(o.key, existing.id);
      if (o.pick) next = fillCriteria(next, existing.id, o.criteria);
      continue;
    }
    if (!o.pick) continue;
    next = edit.addOutcome(next, {
      text: o.text,
      ...(o.bloom ? { bloom: o.bloom } : {}),
      ...(o.criteria ? { criteria: o.criteria } : {}),
    });
    idByKey.set(o.key, next.outcomes.at(-1)?.id ?? "");
    outcomes++;
  }
  for (const a of s.assessments) {
    if (!a.pick) continue;
    const existing = next.assessments.find((c) => same(c.title, a.title));
    if (existing) {
      next = fillAssessment(next, existing.id, a.details, a.parts, idByKey);
      continue;
    }
    const coverage = a.outcomeKeys.flatMap((k) => {
      const outcomeId = idByKey.get(k);
      const bloom = a.outcomeBlooms?.[k];
      return outcomeId ? [{ outcomeId, ...(bloom ? { bloom } : {}) }] : [];
    });
    next = edit.addAssessment(next, {
      title: a.title,
      kind: a.kind,
      weight: a.weight,
      week: a.week,
      coverage,
    });
    next = fillAssessment(next, next.assessments.at(-1)?.id ?? "", a.details, a.parts, idByKey);
    assessments++;
  }
  if (
    next.outcomes.length > COURSE_LIMITS.outcomes ||
    next.assessments.length > COURSE_LIMITS.assessments
  )
    return { ok: false, error: "limit" };
  if (!CourseDataSchema.safeParse(next).success) return { ok: false, error: "invalid" };
  return { ok: true, data: next, added: { outcomes, assessments } };
}
