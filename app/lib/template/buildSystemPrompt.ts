import { getRuntimePrompt } from "~/lib/prompts";
import type { ContextProfile } from "~/lib/context/types";
import { formatProfile } from "~/lib/context/format";
import type { OutputLanguage, StageDependency } from "~/lib/registry/types";
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
}

/**
 * Resolve a stage's runtime prompt and fill all placeholders:
 *  - form `values`
 *  - {{contextProfile}}  ← formatted HBO-i profile (or "")
 *  - {{outputLanguage}}  ← "Nederlands" / "Engels"
 *  - consumed prior-stage outputs under their declared placeholders
 */
export function buildSystemPrompt(args: BuildSystemPromptArgs): string {
  const template = getRuntimePrompt(args.promptId, args.outputLanguage);

  const values: TemplateValues = {
    ...args.values,
    contextProfile: formatProfile(args.profile, args.outputLanguage),
    outputLanguage: LANGUAGE_LABEL[args.outputLanguage],
  };

  const allowEmpty = ["contextProfile"];

  for (const dep of args.consumes ?? []) {
    const output = args.priorOutputs?.[dep.fromStageId];
    if (output === undefined) {
      throw new Error(
        `Uitvoer van eerdere fase "${dep.fromStageId}" ontbreekt (nodig voor {{${dep.placeholder}}}).`,
      );
    }
    values[dep.placeholder] = output;
  }

  return interpolate(template, values, { allowEmpty });
}
