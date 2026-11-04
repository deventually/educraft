/**
 * The BDB/BKE workplace dossier (brief P25). Pure data: no server, no LLM.
 * The institution's own framework is the yardstick; the teacher confirms it,
 * owns every criterion status, and writes the chapters.
 */

export const TRACKS = ["bdb", "bke"] as const;
export type Track = (typeof TRACKS)[number];

/** One assessable criterion from the institution's form. */
export interface Criterion {
  id: string;
  text: string;
  /** Optional "goed"/excellent description: what makes the evidence stronger. */
  strongLevel?: string;
}

/** A learning outcome / core task / BKE quality, holding its criteria. */
export interface Outcome {
  id: string;
  code: string;
  title: string;
  criteria: Criterion[];
  /** Evidence the form asks for, e.g. "Feedback van de werkplekbegeleider". */
  requiredEvidence: string[];
}

export interface FormRequirements {
  maxWords?: number;
  minConstructedItems?: number;
  minAnalysedItems?: number;
  aiDisclosureRequired?: boolean;
  notes?: string;
}

export interface Framework {
  institution: string;
  year?: string;
  outcomes: Outcome[];
  requirements: FormRequirements;
  /** Set when the teacher confirms the framework; any framework edit clears it. */
  confirmedAt?: number;
}

export const CRITERION_STATUSES = ["not-started", "in-progress", "shown"] as const;
export type CriterionStatus = (typeof CRITERION_STATUSES)[number];

export const EVIDENCE_KINDS = [
  "lesson-plan",
  "observation-notes",
  "feedback",
  "test-material",
  "analysis",
  "other",
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export interface EvidenceItem {
  id: string;
  title: string;
  kind: EvidenceKind;
  /** Extracted or pasted text; files are never stored. */
  text: string;
  criterionIds: string[];
  sourceGenerationId?: string;
}

export interface Chapter {
  id: string;
  outcomeId: string;
  /** Markdown. */
  text: string;
  /** True once the teacher used "laat opstellen"; drives only the AI disclosure. */
  aiDrafted: boolean;
}

export interface Reference {
  id: string;
  /** One APA reference, as the teacher typed it. */
  apa: string;
}

export interface AiLogEntry {
  at: number;
  action: "review" | "draft";
  outcomeId: string;
  model: string;
}

export const VERDICTS = ["shown", "partial", "missing"] as const;
export type Verdict = (typeof VERDICTS)[number];

/** The coach's advice on one criterion. Advice only: it never sets a status. */
export interface CriterionReview {
  criterionId: string;
  verdict: Verdict;
  /** A span copied verbatim from the chapter (checked in code). */
  quote?: string;
  /** True when the model gave a quote that is not in the chapter: dropped, verdict lowered. */
  quoteUnverified?: boolean;
  gap?: string;
  strengthen: string[];
  evidenceNeeded: string[];
}

export interface CoachReview {
  criteria: CriterionReview[];
  overall: string;
}

/** The latest review of one outcome, kept so a page reload does not lose it. */
export interface StoredReview {
  at: number;
  model: string;
  review: CoachReview;
}

export interface DossierData {
  tracks: Track[];
  framework: Framework;
  /** criterionId → status, set by the teacher only. Absent = not started. */
  status: Record<string, CriterionStatus>;
  evidence: EvidenceItem[];
  chapters: Chapter[];
  references: Reference[];
  coachMode: "coach" | "draft";
  draftNoticeSeenAt?: number;
  aiLog: AiLogEntry[];
  /** outcomeId → the latest coach review of that outcome. */
  reviews?: Record<string, StoredReview>;
}
