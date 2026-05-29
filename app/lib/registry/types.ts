import type { LocalizedText } from "~/lib/i18n/localized";
import type { ChatMessage as AIChatMessage } from "~/lib/ai/types";

export type ChatMessage = AIChatMessage;

/**
 * The Tool registry — EduCraft's single most important abstraction.
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
  | "image";

export interface FieldOption {
  value: string;
  /** Localized label shown in the UI. */
  label: LocalizedText;
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
}

export interface OutputFormat {
  kind: "markdown" | "json" | "structured-sections";
  /** Localized hint shown to the user about what this stage produces. */
  hint?: LocalizedText;
  /** Expected headings; drives copy/export structure. */
  sections?: string[];
}

/** Injects an earlier stage's output into this stage's prompt under a placeholder. */
export interface StageDependency {
  /** Placeholder name in this stage's template, e.g. "coordinatesDocument". */
  placeholder: string;
  /** Stage id whose output fills it. */
  fromStageId: string;
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
}

export interface ChatConfig {
  /** Opening assistant message. */
  greeting?: LocalizedText;
  /** Suggested starter prompts shown as chips. */
  starters?: LocalizedText[];
  allowRegenerate?: boolean;
  allowStop?: boolean;
}

export interface Attribution {
  /** Exact book chapter title (EN). */
  chapterTitle: string;
  /** Chapter author(s), exactly as printed. */
  authors: string;
  bookTitle: string;
  editor: string;
  doi: string;
  year: number;
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
}

export interface Theory {
  /** Theory/method name, e.g. "Backward Design (Understanding by Design)". */
  name: LocalizedText;
  /** Short localized explainer shown in the tool header. */
  summary: LocalizedText;
  keyCitations: string[];
}

export interface Tool {
  id: string;
  /** URL: /tools/<slug>. */
  slug: string;
  /** Localized display name. */
  name: LocalizedText;
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

  /** Always present. length === 1 for simple generators & chat tools. */
  stages: ToolStage[];

  /** Present iff mode === "chat". */
  chat?: ChatConfig;

  /** Catalog model id. */
  defaultModel: string;
  defaultTemperature?: number;

  /** Whether the HBO-i context profile is injected by default. */
  usesContextProfile: boolean;

  /** Default output language; overridable per generation. */
  defaultOutputLanguage: OutputLanguage;

  /** Feature flag per roadmap phase. */
  enabled: boolean;
  phase: 1 | 2 | 3 | 4;
}
