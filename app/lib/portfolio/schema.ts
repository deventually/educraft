import { z } from "zod";
import { TICKABLE_CODES } from "./readiness";
import {
  CRITERION_STATUSES,
  type DossierData,
  EVIDENCE_KINDS,
  PROOFREAD_ISSUES,
  type Track,
  TRACKS,
  VERDICTS,
} from "./types";

/** Boundary limits for a dossier (brief P25, "Het model"). */
export const LIMITS = {
  id: 100,
  name: 200,
  code: 20,
  title: 200,
  criterionText: 1_000,
  criteriaPerOutcome: 15,
  outcomes: 10,
  requiredEvidence: 20,
  requiredEvidenceText: 300,
  outlineSections: 12,
  sectionDescription: 1_000,
  literature: 10,
  notes: 2_000,
  /** Same cap as a `kind: "document"` field in the stream. */
  documentText: 300_000,
  evidence: 100,
  chapters: 20,
  references: 200,
  reference: 500,
  aiLog: 500,
  anchorDescription: 1_000,
  hoursPerDay: 12,
} as const;

const Id = z.string().min(1).max(LIMITS.id);

/** Coach output limits (brief P25, 25.5). */
export const COACH_LIMITS = {
  quote: 1_500,
  gap: 1_000,
  item: 500,
  items: 3,
  overall: 600,
} as const;

const CriterionReviewSchema = z.object({
  criterionId: Id,
  verdict: z.enum(VERDICTS),
  quote: z.string().max(COACH_LIMITS.quote).optional(),
  quoteUnverified: z.boolean().optional(),
  gap: z.string().max(COACH_LIMITS.gap).optional(),
  strengthen: z.array(z.string().max(COACH_LIMITS.item)).max(COACH_LIMITS.items),
  evidenceNeeded: z.array(z.string().max(COACH_LIMITS.item)).max(COACH_LIMITS.items),
});

const CoachReviewSchema = z.object({
  criteria: z.array(CriterionReviewSchema).max(LIMITS.criteriaPerOutcome),
  overall: z.string().max(COACH_LIMITS.overall),
});

/** Guided writing limits (BDB/BKE plan, step 6). */
export const GUIDED_LIMITS = {
  minQuestions: 2,
  questions: 4,
  question: 300,
  answer: 3_000,
} as const;

const GuidedSectionSchema = z.object({
  questions: z.array(z.string().min(1).max(GUIDED_LIMITS.question)).max(GUIDED_LIMITS.questions),
  answers: z.array(z.string().max(GUIDED_LIMITS.answer)).max(GUIDED_LIMITS.questions),
  at: z.number().int().nonnegative(),
  model: z.string().max(200),
  /** When a paragraph was last drafted from these answers; new questions clear it. */
  draftedAt: z.number().int().nonnegative().optional(),
});

/** Proofreading output limits. */
export const PROOFREAD_LIMITS = {
  suggestions: 12,
  quote: 600,
  explanation: 400,
  suggestion: 800,
} as const;

const ProofreadSuggestionSchema = z.object({
  quote: z.string().min(1).max(PROOFREAD_LIMITS.quote),
  issue: z.enum(PROOFREAD_ISSUES),
  explanation: z.string().max(PROOFREAD_LIMITS.explanation),
  suggestion: z.string().max(PROOFREAD_LIMITS.suggestion),
});

const CriterionSchema = z.object({
  id: Id,
  text: z.string().min(1).max(LIMITS.criterionText),
  strongLevel: z.string().max(LIMITS.criterionText).optional(),
  unverified: z.boolean().optional(),
});

const OutcomeSchema = z.object({
  id: Id,
  code: z.string().max(LIMITS.code),
  title: z.string().min(1).max(LIMITS.title),
  criteria: z.array(CriterionSchema).max(LIMITS.criteriaPerOutcome),
  requiredEvidence: z
    .array(z.string().min(1).max(LIMITS.requiredEvidenceText))
    .max(LIMITS.requiredEvidence),
  outline: z
    .array(
      z.object({
        id: Id,
        title: z.string().min(1).max(LIMITS.title),
        description: z.string().max(LIMITS.sectionDescription).optional(),
        criterionIds: z.array(Id).max(LIMITS.criteriaPerOutcome),
        unverified: z.literal(true).optional(),
      }),
    )
    .max(LIMITS.outlineSections)
    .optional(),
  literature: z.array(z.string().min(1).max(LIMITS.reference)).max(LIMITS.literature).optional(),
});

const FrameworkSchema = z.object({
  institution: z.string().max(LIMITS.name),
  year: z.string().max(20).optional(),
  outcomes: z.array(OutcomeSchema).max(LIMITS.outcomes),
  requirements: z.object({
    maxWords: z.number().int().positive().max(100_000).optional(),
    minConstructedItems: z.number().int().nonnegative().max(500).optional(),
    minAnalysedItems: z.number().int().nonnegative().max(500).optional(),
    aiDisclosureRequired: z.boolean().optional(),
    notes: z.string().max(LIMITS.notes).optional(),
  }),
  confirmedAt: z.number().int().nonnegative().optional(),
  national: z.literal(true).optional(),
  provisional: z.literal(true).optional(),
});

const EvidenceSchema = z.object({
  id: Id,
  title: z.string().min(1).max(LIMITS.title),
  kind: z.enum(EVIDENCE_KINDS),
  text: z.string().max(LIMITS.documentText),
  criterionIds: z.array(Id).max(LIMITS.criteriaPerOutcome * LIMITS.outcomes),
  sourceGenerationId: Id.optional(),
  requirements: z
    .array(z.object({ outcomeId: Id, line: z.string().min(1).max(LIMITS.requiredEvidenceText) }))
    .max(LIMITS.requiredEvidence * LIMITS.outcomes)
    .optional(),
  sourceCourse: z
    .object({
      courseId: Id,
      part: z.union([
        z.literal("outcomes-and-matrix"),
        z.object({ assessmentId: Id, dossier: z.literal(true).optional() }),
      ]),
      at: z.number().int().nonnegative(),
      itemCount: z.number().int().nonnegative().max(1_000).optional(),
    })
    .optional(),
});

const AnchorSchema = z
  .object({
    course: z.object({ courseId: Id, itemId: Id.optional() }).optional(),
    description: z.string().min(1).max(LIMITS.anchorDescription).optional(),
  })
  .refine((a) => a.course !== undefined || a.description !== undefined, "empty anchor");

/** An ISO date, `YYYY-MM-DD`. */
export const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => !Number.isNaN(Date.parse(v)), "not a date");

const ChapterSchema = z.object({
  id: Id,
  outcomeId: Id,
  text: z.string().max(LIMITS.documentText),
  aiDrafted: z.boolean(),
});

export const DossierDataSchema = z
  .object({
    tracks: z.array(z.enum(TRACKS)).min(1).max(TRACKS.length),
    framework: FrameworkSchema,
    status: z.record(Id, z.enum(CRITERION_STATUSES)),
    evidence: z.array(EvidenceSchema).max(LIMITS.evidence),
    chapters: z.array(ChapterSchema).max(LIMITS.chapters),
    references: z
      .array(z.object({ id: Id, apa: z.string().min(1).max(LIMITS.reference) }))
      .max(LIMITS.references),
    coachMode: z.enum(["coach", "draft"]),
    draftNoticeSeenAt: z.number().int().nonnegative().optional(),
    aiLog: z
      .array(
        z.object({
          at: z.number().int().nonnegative(),
          action: z.enum(["review", "draft", "rehearsal", "proofread"]),
          outcomeId: Id.optional(),
          model: z.string().max(200),
        }),
      )
      .max(LIMITS.aiLog),
    guided: z
      .record(
        Id,
        z
          .record(Id, GuidedSectionSchema)
          .refine(
            (r) => Object.keys(r).length <= LIMITS.outlineSections + LIMITS.criteriaPerOutcome,
          ),
      )
      .optional(),
    reviews: z
      .record(
        Id,
        z.object({
          at: z.number().int().nonnegative(),
          model: z.string().max(200),
          provisional: z.literal(true).optional(),
          review: CoachReviewSchema,
        }),
      )
      .optional(),
    proofreads: z
      .record(
        Id,
        z.object({
          at: z.number().int().nonnegative(),
          model: z.string().max(200),
          suggestions: z.array(ProofreadSuggestionSchema).max(PROOFREAD_LIMITS.suggestions),
        }),
      )
      .optional(),
    readiness: z
      .object({ ticked: z.partialRecord(z.enum(TICKABLE_CODES), z.number().int().nonnegative()) })
      .optional(),
    anchors: z.record(Id, AnchorSchema).optional(),
    deadline: IsoDate.optional(),
    hoursPerDay: z.number().int().min(1).max(LIMITS.hoursPerDay).optional(),
  })
  .superRefine((d, ctx) => {
    // The stored graph is always consistent: no dangling or duplicate ids.
    const outcomeIds = new Set<string>();
    const criterionIds = new Set<string>();
    for (const o of d.framework.outcomes) {
      if (outcomeIds.has(o.id))
        ctx.addIssue({ code: "custom", message: `duplicate outcome ${o.id}` });
      outcomeIds.add(o.id);
      for (const c of o.criteria) {
        if (criterionIds.has(c.id))
          ctx.addIssue({ code: "custom", message: `duplicate criterion ${c.id}` });
        criterionIds.add(c.id);
      }
      // A section covers criteria of its own outcome only.
      const own = new Set(o.criteria.map((c) => c.id));
      const sectionIds = new Set<string>();
      for (const s of o.outline ?? []) {
        if (sectionIds.has(s.id))
          ctx.addIssue({ code: "custom", message: `duplicate section ${s.id}` });
        sectionIds.add(s.id);
        for (const id of s.criterionIds)
          if (!own.has(id))
            ctx.addIssue({ code: "custom", message: `section ${s.id} covers foreign ${id}` });
      }
    }
    for (const id of Object.keys(d.status)) {
      if (!criterionIds.has(id))
        ctx.addIssue({ code: "custom", message: `status for unknown ${id}` });
    }
    for (const e of d.evidence) {
      for (const id of e.criterionIds) {
        if (!criterionIds.has(id))
          ctx.addIssue({ code: "custom", message: `evidence links unknown criterion ${id}` });
      }
    }
    const chapterOutcomes = new Set<string>();
    for (const ch of d.chapters) {
      if (!outcomeIds.has(ch.outcomeId))
        ctx.addIssue({ code: "custom", message: `chapter for unknown outcome ${ch.outcomeId}` });
      if (chapterOutcomes.has(ch.outcomeId))
        ctx.addIssue({ code: "custom", message: `two chapters for outcome ${ch.outcomeId}` });
      chapterOutcomes.add(ch.outcomeId);
    }
    for (const id of Object.keys(d.anchors ?? {})) {
      if (!outcomeIds.has(id))
        ctx.addIssue({ code: "custom", message: `anchor for unknown ${id}` });
    }
  });

/** A fresh dossier: no framework yet, coaching on. */
export function emptyDossier(tracks: Track[]): DossierData {
  return {
    tracks: [...tracks],
    framework: { institution: "", outcomes: [], requirements: {} },
    status: {},
    evidence: [],
    chapters: [],
    references: [],
    coachMode: "coach",
    aiLog: [],
  };
}
