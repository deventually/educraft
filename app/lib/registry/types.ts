import type { ComputationId } from "~/lib/template/computations";
import type { ExportKind } from "~/lib/export/formats";
import type { DerivationId } from "~/lib/template/derivations";
import type { LocalizedText } from "~/lib/i18n/localized";
import type { ChatMessage as AIChatMessage } from "~/lib/ai/types";

export type ChatMessage = AIChatMessage;

/**
 * The Tool registry — LimeOnIt's single most important abstraction.
 *
 * Every pedagogical tool from *The Pedagogical Promptbook* (CC BY 4.0) conforms to
 * this one shape, regardless of whether it is an instructor-facing generator or a
 * student-facing chatbot, one-shot or multi-turn, single-stage or multi-stage.
 *
 * `stages[]` is the unifier:
 *   - a one-shot generator        → one stage, `mode: "one-shot"`
 *   - the Cognitive Architect      → four chained stages, `mode: "one-shot"`
 *   - a chatbot (Phase 3)          → one stage + a `chat` config, `mode: "chat"`
 *
 * The book's "Task Sandbox" / fill-in fields map directly onto a tool's typed
 * `inputs`, which auto-render the form (see DynamicForm).
 */

export type UserType = "instructor" | "student";
export type InteractionMode = "one-shot" | "chat";
export type OutputLanguage = "nl" | "en";

export type FieldKind =
  | "text"
  | "textarea"
  | "select"
  | "multiselect"
  | "number"
  | "boolean"
  | "file"
  | "image"
  | "document";

export interface FieldOption {
  value: string;
  /** Localized label shown in the UI. */
  label: LocalizedText;
}

/** Scalar teaching-context attributes a field may derive its default from. */
export type ProfilePrefillSource =
  | "studyYear"
  | "eqf"
  | "programme"
  | "courseName"
  | "domain"
  | "pedagogy";

/**
 * Declares that a field's initial value can be derived from the selected
 * teaching-context profile, so a teacher needn't re-enter what the profile
 * already states. The field stays editable — a per-task override.
 */
export interface ProfilePrefill {
  /** Profile attribute to read; with a list, the first one the profile has. */
  source: ProfilePrefillSource | ProfilePrefillSource[];
  /**
   * Optional lookup from the (stringified) source value to this field's value —
   * e.g. mapping a study year 1–4 onto a course-level option. When omitted, the
   * source value is copied through (stringified).
   */
  map?: Record<string, string>;
}

/** Which part of an assessment model fills a field. Data, not control flow. */
export interface AssessmentModelPrefill {
  source: "framework" | "scale";
}

export type TrackPrefillSource = "feedbackHistory" | "criteria" | "weakPoints";

/** Which part of a track fills a field (P38.4): the track the tool was opened from. */
export interface TrackPrefill {
  /**
   * `feedbackHistory`: the earlier feedback of the track's rounds, oldest first (P38.4).
   * `criteria`: the framework of the track's assessment model (P38.6).
   * `weakPoints`: the improvement points of the newest feedforward round (P38.6).
   */
  source: TrackPrefillSource;
}

/** Which part of a course fills a field (P20, 20.4). Data, not control flow. */
export interface CoursePrefill {
  /**
   * `learningOutcomes`: one outcome per line; opened from a lesson or test, only its own.
   * `lessonGoal`: the lesson's own goal; without one, as `learningOutcomes`.
   * `itemTitle`: the title of the lesson or test the tool was opened for, after its
   * discipline's name when it has one.
   * `earlierLessons`: the (at most five) lessons in the weeks just before it, with the week;
   * with a discipline, only that discipline's lessons.
   * `sessionMinutes`, `groupSize`, `deliveryMode`: from the course's schedule (a number field,
   * a select with the options `in-person`, `online`, `hybrid`).
   */
  source:
    | "learningOutcomes"
    | "lessonGoal"
    | "itemTitle"
    | "earlierLessons"
    | "sessionMinutes"
    | "groupSize"
    | "deliveryMode";
}

export interface InputField {
  /** Becomes a {{name}} placeholder key in the prompt template. */
  name: string;
  /** Localized label. */
  label: LocalizedText;
  kind: FieldKind;
  required?: boolean;
  /** Localized helper text shown inside the input. */
  placeholder?: LocalizedText;
  /** Localized tooltip / longer description shown under the label. */
  help?: LocalizedText;
  defaultValue?: string | number | boolean | string[];
  /** For select / multiselect. */
  options?: FieldOption[];
  /** For number. */
  min?: number;
  max?: number;
  step?: number;
  /** For file / image, e.g. "image/png,image/jpeg". */
  accept?: string;
  /** Optional localized UI grouping, e.g. "Cursuscontext" / "Course context". */
  group?: LocalizedText;
  /** For textarea sizing. */
  rows?: number;
  /** Optional: derive this field's initial value from the selected profile. */
  prefillFromProfile?: ProfilePrefill;
  /** Optional: fill this field from the selected course (P20): one learning outcome per line. */
  prefillFromCourse?: CoursePrefill;
  /**
   * Optional: fill this field from the assessment model the teacher picks (or their own model
   * for the document type in `Tool.assessmentModels.byField`). Stays editable.
   */
  prefillFromAssessmentModel?: AssessmentModelPrefill;
  /** Optional: fill this field from the track the tool was opened from (P38.4). Stays editable. */
  prefillFromTrack?: TrackPrefill;
  /**
   * Student work: before sending, the browser replaces names and other personal
   * details in this field by codes the teacher reviews (P24, 24.0b).
   */
  redact?: boolean;
  /**
   * For an image field: also offer the figures of the files uploaded in this
   * `document` field, each to tick on or off (never sent unless ticked).
   */
  imagesFrom?: string;
}

export interface OutputFormat {
  kind: "markdown" | "json" | "structured-sections";
  /** Localized hint shown to the user about what this stage produces. */
  hint?: LocalizedText;
  /** Expected headings; drives copy/export structure. */
  sections?: string[];
  /**
   * What this result *is* for an export (P30): the export module picks the file
   * formats for it (`app/lib/export/formats.ts`). Absent = "document".
   */
  exportAs?: ExportKind;
  /**
   * For a `slides` result (P30.4): which of its headings the deck is made from, as the prompt
   * writes them per language. Required when `exportAs` is `slides`.
   */
  slides?: SlideOutline;
  /**
   * A note computed in code from the finished output and shown under it (P31.3), so a
   * number never depends on the AI's arithmetic. Ids live in `app/lib/template/computations.ts`.
   */
  computed?: ComputationId;
}

/** The headings of a lesson plan that become slides (P30.4), each as the prompt writes it. */
export interface SlideOutline {
  /** Its text is the opening slide (the learning goal and success criterion). */
  opening: LocalizedText;
  /** Each sub-heading under it is a phase: a slide of its own. */
  phases: LocalizedText;
  /** Its points are the closing slide (coming back in later lessons). */
  closing: LocalizedText;
}

/** Injects an earlier stage's output into this stage's prompt under a placeholder. */
export interface StageDependency {
  /** Placeholder name in this stage's template, e.g. "coordinatesDocument". */
  placeholder: string;
  /** Stage id whose output fills it. */
  fromStageId: string;
  /**
   * Fill the placeholder with something computed in code from that output instead
   * of the output itself, e.g. "question-plan" (app/lib/template/derivations.ts).
   */
  derive?: DerivationId;
}

/** A single LLM step. One-shot generators and chat tools have exactly one. */
export interface ToolStage {
  id: string;
  /** Localized display name of the stage. */
  name: LocalizedText;
  /** Localized description of the stage. */
  description?: LocalizedText;
  /** Prompt-template id resolved from app/lib/prompts (the PROMPTS map). */
  systemPromptId: string;
  /** Inputs specific to this stage (in addition to tool-level `inputs`). */
  inputs?: InputField[];
  /** Earlier-stage outputs this stage consumes (supports multiple). */
  consumes?: StageDependency[];
  /** Optional/advanced stage the user can skip (e.g. validation). */
  optional?: boolean;
  output: OutputFormat;
  /** Per-stage model override (catalog id). */
  model?: string;
  temperature?: number;
  /** Per-stage output-token cap; overrides the tool's `defaultMaxTokens`. */
  maxTokens?: number;
  /**
   * What this stage's output can become in a linked course (P26.2):
   * "assessment-items" = a blueprint table that becomes a test's questions;
   * "lesson" = a lesson plan that can be added as a lesson of the course.
   */
  courseExport?: "assessment-items" | "lesson";
}

export interface ChatConfig {
  /** Opening assistant message. */
  greeting?: LocalizedText;
  /** Suggested starter prompts shown as chips. */
  starters?: LocalizedText[];
  allowRegenerate?: boolean;
  allowStop?: boolean;
  /**
   * Fixed replies offered as buttons once the conversation runs, e.g. the closing
   * words of the rehearsal ("Rond af", P29.3). Data, not a per-tool branch.
   */
  quickReplies?: LocalizedText[];
  /**
   * A short reminder added to the last user turn on every request, next to the language
   * directive (`reinforceLanguage`), where it is read last. For rules a long chat drifts
   * from, such as one question per turn (P31.1b, meting dyw3). Never saved in the transcript.
   */
  turnReminder?: LocalizedText;
}

export interface Attribution {
  /**
   * True for tools original to LimeOnIt (not derived from the book). The book
   * fields below are then omitted and `source` is shown instead.
   */
  original?: boolean;
  /** Human-readable origin for an original tool, e.g. "Origineel LimeOnIt-instrument". */
  source?: LocalizedText;
  /** Exact book chapter title (EN). Omitted for original tools. */
  chapterTitle?: string;
  /** Chapter author(s), exactly as printed. */
  authors?: string;
  bookTitle?: string;
  editor?: string;
  doi?: string;
  year?: number;
  license: "CC BY 4.0";
  /** Appendix page range the prompt was extracted from. */
  sourcePages?: string;
  /** Model the chapter reported using during evaluation, if stated. */
  evaluatedWith?: LocalizedText;
  /**
   * True when the runtime prompt was adapted (e.g. interview → one-shot, or
   * translated to Dutch). The verbatim original is preserved in the prompt file
   * and surfaced in the UI for fidelity.
   */
  adapted?: boolean;
  /**
   * What LimeOnIt changed compared with the book's prompt, and why, in plain
   * words. Shown instead of the generic "adapted" notice (BESLUIT-2026-11-04-22).
   */
  adaptation?: LocalizedText;
  /**
   * An "improved" claim, allowed only with a measurement: the report in
   * evals/reports/ that shows it (tests/tool-attribution.test.ts checks it exists).
   */
  improvedAfter?: { date: string; report: string; summary: LocalizedText };
}

export interface Theory {
  /** Theory/method name, e.g. "Backward Design (Understanding by Design)". */
  name: LocalizedText;
  /** Short localized explainer shown in the tool header. */
  summary: LocalizedText;
  keyCitations: string[];
}

/** A kind of course item a tool can be offered at (P27.4). */
export const COURSE_ITEM_KINDS = ["outcome", "activity", "assessment"] as const;
export type CourseItemKind = (typeof COURSE_ITEM_KINDS)[number];

export interface Tool {
  id: string;
  /** URL: /tools/<slug>. */
  slug: string;
  /** Localized display name: task first (what the teacher wants to do). */
  name: LocalizedText;
  /** Book/technique name, shown small under the name. Data only, never branched on. */
  subtitle?: LocalizedText;
  /** One-line localized pitch shown on the card. */
  tagline: LocalizedText;
  /** Lucide icon name, e.g. "compass". */
  icon?: string;
  userType: UserType;
  mode: InteractionMode;
  theory: Theory;
  attribution: Attribution;

  /** Tool-level inputs shared across all stages (the "Task Sandbox"). */
  inputs: InputField[];

  /** Always at least one. length === 1 for simple generators & chat tools. */
  stages: [ToolStage, ...ToolStage[]];

  /** Present iff the tool is a chat (`mode: "chat"`). */
  chat?: ChatConfig;

  /** Catalog model id. */
  defaultModel: string;
  defaultTemperature?: number;
  /**
   * Default output-token cap for this tool's generations (bounds cost/latency).
   * A stage may override it via `ToolStage.maxTokens`. Absent → the provider's
   * built-in fallback (8192) applies.
   */
  defaultMaxTokens?: number;

  /** Whether the HBO-i context profile is injected by default. */
  usesContextProfile: boolean;

  /**
   * Fields marked `prefillFromAssessmentModel` are filled from an assessment model: the
   * teacher picks one, or their own model for the value of the select field `byField`
   * (e.g. the document type) is filled in. Starters are only filled in when picked.
   */
  assessmentModels?: { byField: string };

  /**
   * Where the prompt's material comes from besides the inputs (P29.3). "dossier": the
   * server builds it from the caller's own BDB/BKE dossier (`dossierPromptValues`),
   * never from the request body; the tool then falls under the workplace feature.
   */
  contextFrom?: "dossier";
  /** Not in the tool catalogue: reached only from its own place (P29.3, BESLUIT-2026-11-05-8). */
  hiddenFromCatalogue?: true;
  /** false: the conversation is not saved as a project (P29.3, Bastiaan's choice). */
  storesConversation?: false;

  /**
   * True for learning-outcome evaluation tools (grading/assessment). Drives the
   * stronger "teacher decides" AI-transparency notice (EU AI Act Annex III
   * framing) purely from data — no per-tool branching in the UI.
   */
  assistiveGrading?: boolean;

  /**
   * True for tools that process student work (P28.4). Their work never reaches a shared
   * view, not even through a shared course (`isShareableWork`, BESLUIT-2026-11-05-5).
   */
  handlesStudentWork?: true;

  /**
   * A student tutor whose prompt the teacher may copy for students to paste into their own
   * AI, as the book intends (P31.1). Data only: the chat shows "Kopieer voor je studenten".
   */
  copyableStudentPrompt?: true;

  /** Default output language; overridable per generation. */
  defaultOutputLanguage: OutputLanguage;

  /**
   * Logical next tools (slugs, at most 3), offered under the result (P27.1). Data only:
   * validated at boot; a tool the viewer may not use is left out by the loader.
   */
  next?: string[];

  /**
   * The kinds of course item this tool shows as a button at (P27.4): on the course page,
   * in the week on Start. Data only; the button opens the tool with `?course=&item=`.
   */
  courseActions?: CourseItemKind[];

  /** Feature flag per roadmap phase. */
  enabled: boolean;
  phase: 1 | 2 | 3 | 4;
}
