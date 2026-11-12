/**
 * The internship and thesis track (P38): one track per student, under a code the teacher
 * chooses, alongside OnStage (BESLUIT-2026-11-12-11). Only redacted text and feedback are ever
 * stored, and a track is wiped after `purgeAfter`. The milestones are data; nothing branches on
 * a milestone. Not `.strict()`: later steps add optional fields without a migration.
 */
import { z } from "zod";
import { IsoDateSchema } from "~/lib/calendar/weeks";

export const MILESTONES = [
  { id: "start", name: { nl: "Start", en: "Start" } },
  { id: "visits", name: { nl: "Bezoeken", en: "Visits" } },
  { id: "drafts", name: { nl: "Concepten", en: "Drafts" } },
  { id: "final", name: { nl: "Eindversie", en: "Final version" } },
  { id: "second-assessor", name: { nl: "Tweede beoordelaar", en: "Second assessor" } },
  { id: "final-interview", name: { nl: "Eindgesprek", en: "Final interview" } },
  { id: "onstage", name: { nl: "Klaar voor OnStage", en: "Ready for OnStage" } },
] as const;

export type MilestoneId = (typeof MILESTONES)[number]["id"];
const MilestoneIdSchema = z.enum(MILESTONES.map((m) => m.id) as [MilestoneId, ...MilestoneId[]]);

const TRACK_KINDS = ["internship", "thesis"] as const;

const TRACK_LIMITS = {
  code: 40,
  /** A whole report, redacted in the browser (like a `document` field in `/api/stream`). */
  redactedText: 300_000,
  feedback: 60_000,
} as const;

/** The teacher's choice when opening a track. The code is free text: the UI warns "no name". */
export const TrackInputSchema = z.object({
  code: z.string().trim().min(1).max(TRACK_LIMITS.code),
  kind: z.enum(TRACK_KINDS),
  courseId: z
    .string()
    .max(100)
    .nullish()
    .transform((v) => v ?? null),
  assessmentModelId: z
    .string()
    .max(100)
    .nullish()
    .transform((v) => v ?? null),
});
export type TrackInput = z.input<typeof TrackInputSchema>;

/** `skipped`: a milestone that does not apply (a thesis without visits) also counts as resolved. */
const MilestoneStatusSchema = z.enum(["open", "done", "skipped"]);

export const TrackDataSchema = z.object({
  status: z.partialRecord(MilestoneIdSchema, MilestoneStatusSchema).default({}),
  /** Hand-in dates per milestone. */
  deadlines: z.partialRecord(MilestoneIdSchema, IsoDateSchema).default({}),
});
export type TrackData = z.infer<typeof TrackDataSchema>;

/** What a round keeps besides the redacted text: the feedback, never the report itself. */
export const RoundFeedbackSchema = z.object({
  text: z.string().trim().min(1).max(TRACK_LIMITS.feedback),
});
export type RoundFeedback = z.infer<typeof RoundFeedbackSchema>;

export const RoundInputSchema = z.object({
  milestone: MilestoneIdSchema,
  redactedText: z.string().max(TRACK_LIMITS.redactedText),
  feedback: RoundFeedbackSchema,
});
export type RoundInput = z.input<typeof RoundInputSchema>;
