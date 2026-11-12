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

export type MilestonePanel = "onstage" | "second-assessor" | "visits";

interface MilestoneTool {
  slug: string;
  label: { nl: string; en: string };
}

interface Milestone {
  id: MilestoneId;
  name: { nl: string; en: string };
  /** The tools that do this milestone's work; a result can be kept as a round. */
  tools?: readonly MilestoneTool[];
  /**
   * The working panel the milestone tab shows: the visits (P38.6), the second assessor's
   * comparison (P38.5) or the OnStage texts (P38.7).
   */
  panel?: MilestonePanel;
  /** Not every programme has it: never counted in the progress, never the next step. */
  optional?: true;
  /** P38.7: the tab where the teacher closes the track (and sees when it is wiped). */
  closes?: true;
}

export const MILESTONES: readonly Milestone[] = [
  {
    id: "start",
    name: { nl: "Start", en: "Start" },
    tools: [
      {
        slug: "stage-assessment",
        label: { nl: "Plan van aanpak toetsen", en: "Check the plan of approach" },
      },
    ],
  },
  {
    id: "visits",
    name: { nl: "Bezoeken", en: "Visits" },
    // P38.6: questions from the criteria; a report from notes that is never kept.
    tools: [
      { slug: "visit-prep", label: { nl: "Bezoek voorbereiden", en: "Prepare a visit" } },
      { slug: "visit-report", label: { nl: "Verslag uit steekwoorden", en: "Report from notes" } },
    ],
    panel: "visits",
  },
  {
    id: "drafts",
    name: { nl: "Concepten", en: "Drafts" },
    // A draft is assessed in full, with the track's earlier feedback along (like the final).
    tools: [
      {
        slug: "stage-assessment",
        label: { nl: "Concept beoordelen", en: "Assess the draft" },
      },
    ],
  },
  {
    id: "final",
    name: { nl: "Eindversie", en: "Final version" },
    // P38.4: opened from the track, the assessment gets the earlier feedback along.
    tools: [
      {
        slug: "stage-assessment",
        label: { nl: "Eindversie beoordelen", en: "Assess the final version" },
      },
    ],
  },
  {
    id: "second-assessor",
    name: { nl: "Tweede beoordelaar", en: "Second assessor" },
    // Mostly for a graduation internship; a teacher who has one uses the tab, else it waits.
    optional: true,
    panel: "second-assessor",
  },
  {
    id: "final-interview",
    name: { nl: "Eindgesprek", en: "Final interview" },
    // P38.6: rehearse with the weak points of the last feedback, then review the defence.
    tools: [
      { slug: "defend-your-work", label: { nl: "Verdedig je werk", en: "Defend your work" } },
      {
        slug: "defense-review",
        label: { nl: "Een verdediging nakijken", en: "Review a defence" },
      },
    ],
  },
  {
    id: "onstage",
    name: { nl: "Klaar voor OnStage", en: "Ready for OnStage" },
    // P38.7: per criterion the confirmed text to paste into OnStage; then close the track.
    panel: "onstage",
    closes: true,
  },
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
  criterion: 300,
  confirmed: 10_000,
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

export const ConfirmedTextSchema = z.object({
  criterion: z.string().trim().min(1).max(TRACK_LIMITS.criterion),
  text: z.string().max(TRACK_LIMITS.confirmed),
});

export const TrackDataSchema = z.object({
  status: z.partialRecord(MilestoneIdSchema, MilestoneStatusSchema).default({}),
  /** Hand-in dates per milestone. */
  deadlines: z.partialRecord(MilestoneIdSchema, IsoDateSchema).default({}),
  /** P38.6: the dates of visits, sorted and once each; never what was said. */
  visits: z
    .array(IsoDateSchema)
    .max(50)
    .default([])
    .transform((v) => [...new Set(v)].sort()),
  /** P38.7: per criterion the text the teacher confirmed for OnStage, in the model's order. */
  onstage: z.array(ConfirmedTextSchema).max(60).default([]),
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
