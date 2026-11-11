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
  /** Set by the framework extraction when the text is not verbatim in the form; saving the criterion clears it. */
  unverified?: boolean;
}

/**
 * One section of the chapter as the form prescribes it (e.g. "Beginsituatie" in a lesson
 * design), with the criteria it covers. Read from the form by the framework extraction.
 */
export interface OutlineSection {
  id: string;
  title: string;
  /** What the form asks to write in this section. */
  description?: string;
  /** Criteria of the same outcome that this section covers. */
  criterionIds: string[];
  /** The title is not verbatim in the form: the teacher checks it. */
  unverified?: true;
}

/** A learning outcome / core task / BKE quality, holding its criteria. */
export interface Outcome {
  id: string;
  code: string;
  title: string;
  criteria: Criterion[];
  /** Evidence the form asks for, e.g. "Feedback van de werkplekbegeleider". */
  requiredEvidence: string[];
  /** The chapter's outline from the form; absent when the form prescribes none. */
  outline?: OutlineSection[];
  /** Sources the form names for this outcome, verbatim; absent when it names none. */
  literature?: string[];
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
  /** Built from the national starting point (`skeleton.ts`), not read from an institution's form. */
  national?: true;
  /**
   * Confirmed as provisional: the national starting point stands in while the teacher waits for
   * the institution's form. The AI works, every verdict says so, and the final export waits for
   * a normal confirmation. Cleared with `confirmedAt`.
   */
  provisional?: true;
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

/** One required-evidence line of an outcome, by its text (the form's own words). */
export interface RequirementRef {
  outcomeId: string;
  line: string;
}

export interface EvidenceItem {
  id: string;
  title: string;
  kind: EvidenceKind;
  /** Extracted or pasted text; files are never stored. */
  text: string;
  criterionIds: string[];
  sourceGenerationId?: string;
  /** The required-evidence lines the teacher ticked this item for (`requirementChecklist`). */
  requirements?: RequirementRef[];
  /** A snapshot of a course (P26.4); "Opnieuw ophalen" replaces the text with the course as it is now. */
  sourceCourse?: {
    courseId: string;
    part: CourseEvidencePart;
    at: number;
    /** The number of questions in a test snapshot, set when fetched (P29.1). */
    itemCount?: number;
  };
}

/** Which part of a course a snapshot shows: outcomes with the coverage matrix, or one assessment. */
export type CourseEvidencePart = "outcomes-and-matrix" | { assessmentId: string };

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
  /** "rehearsal" (P29.3): written when the teacher keeps rehearsal feedback; no outcome. */
  action: "review" | "draft" | "rehearsal" | "proofread";
  outcomeId?: string;
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
  /** Made on a provisional framework: the verdicts are on the national starting point. */
  provisional?: true;
  review: CoachReview;
}

export const PROOFREAD_ISSUES = [
  "spelling",
  "grammar",
  "style",
  "person",
  "repetition",
  "apa",
  "consistency",
] as const;
export type ProofreadIssue = (typeof PROOFREAD_ISSUES)[number];

/** One proofreading proposal: a span copied from the chapter and a better version. */
export interface ProofreadSuggestion {
  /** The chapter's own text, exactly as it stands (checked and located in code). */
  quote: string;
  issue: ProofreadIssue;
  explanation: string;
  suggestion: string;
}

/** The latest proofreading of one chapter; taken-over or ignored proposals leave the list. */
export interface StoredProofread {
  at: number;
  model: string;
  suggestions: ProofreadSuggestion[];
}

/**
 * What one learning outcome is about (step 4 of the guided route): a module, lesson or test in one
 * of the teacher's courses, or a short description in their own words, or both. Tools opened for
 * this outcome start on the course and item; nothing else reads the course live.
 */
export interface Anchor {
  /** No `itemId`: the whole course, as the module. */
  course?: { courseId: string; itemId?: string };
  description?: string;
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
  /** outcomeId → the latest proofreading of that outcome's chapter. */
  proofreads?: Record<string, StoredProofread>;
  /** Self-checks of "Klaar om in te leveren?" (P29.1): code → when the teacher ticked it. */
  readiness?: { ticked: Partial<Record<string, number>> };
  /** outcomeId → its anchor, set in the start wizard. */
  anchors?: Record<string, Anchor>;
  /** The hand-in date as an ISO date (`YYYY-MM-DD`). */
  deadline?: string;
}
