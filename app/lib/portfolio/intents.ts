/**
 * The form boundary of the BDB/BKE workplace: one `intent` per `<Form>`, parsed
 * with Zod and applied with the pure edits. Pure (no server, no DB), so every
 * route action stays thin: load the dossier, `applyIntent`, save.
 */
import { z } from "zod";
import * as edit from "./edit";
import { DossierDataSchema, LIMITS } from "./schema";
import { TICKABLE_CODES } from "./readiness";
import { skeletonOutcomes } from "./skeleton";
import { CRITERION_STATUSES, type DossierData, EVIDENCE_KINDS } from "./types";
import type { Locale } from "~/lib/i18n";

export type IntentError = "invalid" | "not-found";
export type IntentResult = { ok: true; data: DossierData } | { ok: false; error: IntentError };

export interface IntentContext {
  now: number;
  locale: Locale;
}

const Id = z.string().min(1).max(LIMITS.id);
const text = (max: number) => z.string().trim().max(max);
const required = (max: number) => z.string().trim().min(1).max(max);
/**
 * An optional whole number from a text field: absent or "" means not set.
 * (Zod 4 returns a `.default()` value as the output and skips transforms, so
 * optional fields use `.optional()` before the transform instead.)
 */
const optionalInt = (max: number) =>
  z
    .string()
    .trim()
    .regex(/^\d*$/)
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .pipe(z.number().int().nonnegative().max(max).optional());
/** One line per item; blank lines dropped; absent = none. */
const lines = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
  );
const omitEmpty = (v: string | undefined) => (v ? v : undefined);

/** Form fields per intent; `getAll` fields are listed in MULTI. */
const SCHEMAS = {
  useSkeleton: z.object({}),
  meta: z.object({
    institution: text(LIMITS.name).default(""),
    year: text(20).default(""),
    maxWords: optionalInt(100_000),
    minConstructedItems: optionalInt(500),
    minAnalysedItems: optionalInt(500),
    aiDisclosureRequired: z.string().optional(),
    notes: text(LIMITS.notes).default(""),
  }),
  addOutcome: z.object({ code: text(LIMITS.code).default(""), title: required(LIMITS.title) }),
  updateOutcome: z.object({
    outcomeId: Id,
    code: text(LIMITS.code).default(""),
    title: required(LIMITS.title),
    requiredEvidence: lines,
  }),
  removeOutcome: z.object({ outcomeId: Id }),
  addCriterion: z.object({
    outcomeId: Id,
    text: required(LIMITS.criterionText),
    strongLevel: text(LIMITS.criterionText).default(""),
  }),
  updateCriterion: z.object({
    criterionId: Id,
    text: required(LIMITS.criterionText),
    strongLevel: text(LIMITS.criterionText).default(""),
  }),
  removeCriterion: z.object({ criterionId: Id }),
  confirm: z.object({}),
  confirmProvisional: z.object({}),
  setStatus: z.object({ criterionId: Id, status: z.enum(CRITERION_STATUSES) }),
  addEvidence: z.object({
    outcomeId: Id,
    title: required(LIMITS.title),
    kind: z.enum(EVIDENCE_KINDS),
    text: z.string().max(LIMITS.documentText).default(""),
    criterionIds: z.array(Id).default([]),
  }),
  updateEvidence: z.object({
    outcomeId: Id,
    evidenceId: Id,
    title: required(LIMITS.title),
    kind: z.enum(EVIDENCE_KINDS),
    text: z.string().max(LIMITS.documentText).default(""),
    criterionIds: z.array(Id).default([]),
  }),
  removeEvidence: z.object({ evidenceId: Id }),
  writeChapter: z.object({ outcomeId: Id, text: z.string().max(LIMITS.documentText) }),
  coachMode: z.object({ mode: z.enum(["coach", "draft"]) }),
  dismissDraftNotice: z.object({}),
  addReference: z.object({ apa: required(LIMITS.reference) }),
  removeReference: z.object({ referenceId: Id }),
  tickReadiness: z.object({ code: z.enum(TICKABLE_CODES), ticked: z.literal("on").optional() }),
  /** Back from Word: the chapters the teacher chose to take over, and new references. */
  importChapters: z.object({
    chapters: z
      .string()
      .max(LIMITS.documentText * LIMITS.outcomes)
      .transform((raw, ctx) => {
        try {
          return JSON.parse(raw) as unknown;
        } catch {
          ctx.addIssue({ code: "custom", message: "invalid JSON" });
          return z.NEVER;
        }
      })
      .pipe(
        z
          .array(z.object({ outcomeId: Id, text: z.string().max(LIMITS.documentText) }))
          .max(LIMITS.outcomes),
      )
      .default([]),
    reference: z.array(z.string().max(LIMITS.reference)).max(LIMITS.references).default([]),
  }),
} as const;

export type Intent = keyof typeof SCHEMAS;
const MULTI = new Set(["criterionIds", "reference"]);

function fields(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(fd.keys())) {
    if (key === "intent") continue;
    const values = fd.getAll(key).filter((v): v is string => typeof v === "string");
    out[key] = MULTI.has(key) ? values : values[0];
  }
  return out;
}

class NotFound extends Error {}

function criteriaOf(d: DossierData, outcomeId: string): Set<string> {
  const outcome = d.framework.outcomes.find((o) => o.id === outcomeId);
  if (!outcome) throw new NotFound(outcomeId);
  return new Set(outcome.criteria.map((c) => c.id));
}

function run(d: DossierData, intent: Intent, input: never, ctx: IntentContext): DossierData {
  switch (intent) {
    case "useSkeleton": {
      if (d.framework.outcomes.length > 0) throw new RangeError("framework not empty");
      let next = d;
      for (const o of skeletonOutcomes(d.tracks, ctx.locale)) {
        next = edit.addOutcome(next, {
          code: o.code,
          title: o.title,
          requiredEvidence: o.requiredEvidence,
        });
        const id = next.framework.outcomes[next.framework.outcomes.length - 1].id;
        for (const c of o.criteria) next = edit.addCriterion(next, id, { text: c.text });
      }
      return { ...next, framework: { ...next.framework, national: true } };
    }
    case "meta": {
      const v = input as z.infer<(typeof SCHEMAS)["meta"]>;
      const requirements = Object.fromEntries(
        Object.entries({
          maxWords: v.maxWords,
          minConstructedItems: v.minConstructedItems,
          minAnalysedItems: v.minAnalysedItems,
          aiDisclosureRequired: v.aiDisclosureRequired ? true : undefined,
          notes: omitEmpty(v.notes),
        }).filter(([, value]) => value !== undefined),
      );
      return edit.updateFrameworkMeta(d, {
        institution: v.institution,
        year: omitEmpty(v.year),
        requirements,
      });
    }
    case "addOutcome": {
      const v = input as z.infer<(typeof SCHEMAS)["addOutcome"]>;
      return edit.addOutcome(d, v);
    }
    case "updateOutcome": {
      const { outcomeId, ...patch } = input as z.infer<(typeof SCHEMAS)["updateOutcome"]>;
      criteriaOf(d, outcomeId);
      return edit.updateOutcome(d, outcomeId, patch);
    }
    case "removeOutcome": {
      const v = input as z.infer<(typeof SCHEMAS)["removeOutcome"]>;
      criteriaOf(d, v.outcomeId);
      return edit.removeOutcome(d, v.outcomeId);
    }
    case "addCriterion": {
      const v = input as z.infer<(typeof SCHEMAS)["addCriterion"]>;
      criteriaOf(d, v.outcomeId);
      return edit.addCriterion(d, v.outcomeId, {
        text: v.text,
        ...(v.strongLevel ? { strongLevel: v.strongLevel } : {}),
      });
    }
    case "updateCriterion": {
      const v = input as z.infer<(typeof SCHEMAS)["updateCriterion"]>;
      if (!d.framework.outcomes.some((o) => o.criteria.some((c) => c.id === v.criterionId)))
        throw new NotFound(v.criterionId);
      return edit.updateCriterion(d, v.criterionId, {
        text: v.text,
        strongLevel: omitEmpty(v.strongLevel),
      });
    }
    case "removeCriterion": {
      const v = input as z.infer<(typeof SCHEMAS)["removeCriterion"]>;
      return edit.removeCriterion(d, v.criterionId);
    }
    case "confirm": {
      if (!d.framework.outcomes.some((o) => o.criteria.length > 0))
        throw new RangeError("nothing to confirm");
      return edit.confirmFramework(d, ctx.now);
    }
    case "confirmProvisional": {
      if (!d.framework.national || !d.framework.outcomes.some((o) => o.criteria.length > 0))
        throw new RangeError("nothing to confirm provisionally");
      return edit.confirmProvisional(d, ctx.now);
    }
    case "setStatus": {
      const v = input as z.infer<(typeof SCHEMAS)["setStatus"]>;
      return edit.setStatus(d, v.criterionId, v.status);
    }
    case "addEvidence": {
      const { outcomeId, ...v } = input as z.infer<(typeof SCHEMAS)["addEvidence"]>;
      const own = criteriaOf(d, outcomeId);
      if (v.criterionIds.some((id) => !own.has(id))) throw new RangeError("foreign criterion");
      return edit.addEvidence(d, v);
    }
    case "updateEvidence": {
      const { outcomeId, evidenceId, ...v } = input as z.infer<(typeof SCHEMAS)["updateEvidence"]>;
      const own = criteriaOf(d, outcomeId);
      if (v.criterionIds.some((id) => !own.has(id))) throw new RangeError("foreign criterion");
      const item = d.evidence.find((e) => e.id === evidenceId);
      if (!item) throw new NotFound(evidenceId);
      // This page only sees its own outcome's criteria: keep the other links.
      const kept = item.criterionIds.filter((id) => !own.has(id));
      return edit.updateEvidence(d, evidenceId, {
        ...v,
        criterionIds: [...kept, ...v.criterionIds],
      });
    }
    case "removeEvidence": {
      const v = input as z.infer<(typeof SCHEMAS)["removeEvidence"]>;
      return edit.removeEvidence(d, v.evidenceId);
    }
    case "writeChapter": {
      const v = input as z.infer<(typeof SCHEMAS)["writeChapter"]>;
      criteriaOf(d, v.outcomeId);
      return edit.writeChapter(d, v.outcomeId, v.text);
    }
    case "coachMode": {
      const v = input as z.infer<(typeof SCHEMAS)["coachMode"]>;
      return { ...d, coachMode: v.mode };
    }
    case "dismissDraftNotice":
      return { ...d, draftNoticeSeenAt: d.draftNoticeSeenAt ?? ctx.now };
    case "addReference": {
      const v = input as z.infer<(typeof SCHEMAS)["addReference"]>;
      return edit.addReference(d, v.apa);
    }
    case "removeReference": {
      const v = input as z.infer<(typeof SCHEMAS)["removeReference"]>;
      return edit.removeReference(d, v.referenceId);
    }
    case "importChapters": {
      const v = input as z.infer<(typeof SCHEMAS)["importChapters"]>;
      let next = d;
      for (const ch of v.chapters) {
        criteriaOf(d, ch.outcomeId);
        next = edit.writeChapter(next, ch.outcomeId, ch.text);
      }
      const have = new Set(next.references.map((r) => r.apa.trim()));
      for (const raw of v.reference) {
        const apa = raw.trim();
        if (!apa || have.has(apa)) continue;
        have.add(apa);
        next = edit.addReference(next, apa);
      }
      return next;
    }
    case "tickReadiness": {
      const v = input as z.infer<(typeof SCHEMAS)["tickReadiness"]>;
      const { [v.code]: at, ...rest } = d.readiness?.ticked ?? {};
      return {
        ...d,
        readiness: { ticked: v.ticked ? { ...rest, [v.code]: at ?? ctx.now } : rest },
      };
    }
  }
}

export function isIntent(value: unknown): value is Intent {
  return typeof value === "string" && Object.hasOwn(SCHEMAS, value);
}

/** Applies one form submission to a dossier. Never throws. */
export function applyIntent(d: DossierData, fd: FormData, ctx: IntentContext): IntentResult {
  const intent = fd.get("intent");
  if (!isIntent(intent)) return { ok: false, error: "invalid" };
  const parsed = SCHEMAS[intent].safeParse(fields(fd));
  if (!parsed.success) return { ok: false, error: "invalid" };
  let next: DossierData;
  try {
    next = run(d, intent, parsed.data as never, ctx);
  } catch (e) {
    if (e instanceof NotFound) return { ok: false, error: "not-found" };
    if (e instanceof Error && /^Unknown /.test(e.message)) return { ok: false, error: "not-found" };
    return { ok: false, error: "invalid" };
  }
  // The stored graph must stay within the dossier limits.
  return DossierDataSchema.safeParse(next).success
    ? { ok: true, data: next }
    : { ok: false, error: "invalid" };
}
