import { getRuntimePrompt } from "~/lib/prompts";
import type { ContextProfile } from "~/lib/context/types";
import { formatProfile, type Audience } from "~/lib/context/format";
import type { OutputLanguage, StageDependency } from "~/lib/registry/types";
import { LANGUAGE_DIRECTIVE } from "./language";
import { DERIVATIONS } from "./derivations";
import { interpolate, type TemplateValues } from "./interpolate";

const LANGUAGE_LABEL: Record<OutputLanguage, string> = {
  nl: "Nederlands",
  en: "Engels",
};

export interface BuildSystemPromptArgs {
  /** ToolStage.systemPromptId. */
  promptId: string;
  /** Submitted form values (field name → value). */
  values: TemplateValues;
  /** Selected HBO-i context profile, if any. */
  profile?: ContextProfile | null;
  outputLanguage: OutputLanguage;
  /** Outputs of earlier stages, keyed by stage id. */
  priorOutputs?: Record<string, string>;
  /** Which prior outputs this stage consumes and under which placeholder. */
  consumes?: StageDependency[];
  /**
   * Who reads the output — governs the level-adaptation directive in
   * {{contextProfile}}. `"learner"` (student-facing tutors) gets the register-first
   * direct-address directive; `"instructor"` (default) keeps the substance-first one.
   */
  audience?: Audience;
}

/**
 * Resolve a stage's runtime prompt and fill all placeholders:
 *  - form `values`
 *  - {{contextProfile}}  ← formatted HBO-i profile (or "")
 *  - {{outputLanguage}}  ← "Nederlands" / "Engels"
 *  - consumed prior-stage outputs under their declared placeholders, or what
 *    a named derivation computes from them (`StageDependency.derive`)
 */
export function buildSystemPrompt(args: BuildSystemPromptArgs): string {
  const template = getRuntimePrompt(args.promptId, args.outputLanguage);

  const values: TemplateValues = {
    ...args.values,
    contextProfile: formatProfile(args.profile, args.outputLanguage, args.audience),
    outputLanguage: LANGUAGE_LABEL[args.outputLanguage],
  };

  const allowEmpty = ["contextProfile"];

  for (const dep of args.consumes ?? []) {
    const output = args.priorOutputs?.[dep.fromStageId];
    if (output === undefined) {
      throw new Error(
        `Output of earlier stage "${dep.fromStageId}" is missing (required for {{${dep.placeholder}}}).`,
      );
    }
    values[dep.placeholder] = dep.derive
      ? DERIVATIONS[dep.derive](output, args.outputLanguage)
      : output;
  }

  const filled = interpolate(template, values, { allowEmpty });
  return `${filled}\n\n${LANGUAGE_DIRECTIVE[args.outputLanguage]}`;
}

export { reinforceLanguage } from "./language";
