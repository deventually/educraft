/**
 * The internship and thesis track (P38): one track per student, under a code the teacher
 * chooses, alongside OnStage (BESLUIT-2026-11-12-11). Only redacted text and feedback are ever
 * stored, and a track is wiped after `purgeAfter`. The milestones are data; nothing branches on
 * a milestone. Not `.strict()`: later steps add optional fields without a migration.
 */
import { z } from "zod";
import { IsoDateSchema } from "~/lib/calendar/weeks";

const MILESTONE_IDS = [
  "start",
  "visits",
  "drafts",
  "final",
  "second-assessor",
  "final-interview",
  "onstage",
] as const;
export type MilestoneId = (typeof MILESTONE_IDS)[number];
export const MilestoneIdSchema = z.enum(MILESTONE_IDS);

interface Milestone {
  id: MilestoneId;
  name: { nl: string; en: string };
  /** The tool that does this milestone's work; its result can be kept as a round. */
  tool?: { slug: string; label: { nl: string; en: string } };
  /** P38.3: each new version gets feedforward, following up the previous round. */
  feedforward?: true;
}

export const MILESTONES: readonly Milestone[] = [
  {
    id: "start",
    name: { nl: "Start", en: "Start" },
    tool: {
      slug: "stage-assessment",
      label: { nl: "Plan van aanpak toetsen", en: "Check the plan of approach" },
    },
  },
  { id: "visits", name: { nl: "Bezoeken", en: "Visits" } },
  { id: "drafts", name: { nl: "Concepten", en: "Drafts" }, feedforward: true },
  {
    id: "final",
    name: { nl: "Eindversie", en: "Final version" },
    // P38.4: opened from the track, the assessment gets the earlier feedback along.
    tool: {
      slug: "stage-assessment",
      label: { nl: "Eindversie beoordelen", en: "Assess the final version" },
    },
  },
  { id: "second-assessor", name: { nl: "Tweede beoordelaar", en: "Second assessor" } },
  { id: "final-interview", name: { nl: "Eindgesprek", en: "Final interview" } },
  { id: "onstage", name: { nl: "Klaar voor OnStage", en: "Ready for OnStage" } },
];

const TRACK_KINDS = ["internship", "thesis"] as const;
export type TrackKind = (typeof TRACK_KINDS)[number];

/** The `documentType` values of *Studentwerk beoordelen* that belong to each kind. */
const KIND_DOCUMENTS: Record<TrackKind, readonly string[]> = {
  internship: ["stageplan", "stageverslag", "portfolio"],
  thesis: ["afstudeerscriptie", "onderzoeksverslag"],
};

/** Whether an assessment model (by its document types) fits a kind of track. */
export const fitsKind = (documentTypes: readonly string[], kind: TrackKind): boolean =>
  documentTypes.some((d) => KIND_DOCUMENTS[kind].includes(d));

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
  /** P38.3: the improvement points of a feedforward round, numbered for the next round. */
  points: z
    .array(
      z.object({
        id: z.string().max(10),
        criterion: z.string().max(200),
        text: z.string().max(1_000),
      }),
    )
    .max(40)
    .optional(),
});
export type RoundFeedback = z.infer<typeof RoundFeedbackSchema>;

export const RoundInputSchema = z.object({
  milestone: MilestoneIdSchema,
  redactedText: z.string().max(TRACK_LIMITS.redactedText),
  feedback: RoundFeedbackSchema,
});
export type RoundInput = z.input<typeof RoundInputSchema>;
