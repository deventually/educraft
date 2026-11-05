/**
 * Derivations: a placeholder filled with something computed in code from an earlier
 * stage's output, instead of the output itself. Registry data names one by id
 * (`StageDependency.derive`); validation checks the id at boot. No per-tool branch.
 */
import { questionPlan } from "~/lib/courses/questionPlan";
import type { OutputLanguage } from "~/lib/registry/types";

export const DERIVATION_IDS = ["question-plan"] as const;
export type DerivationId = (typeof DERIVATION_IDS)[number];

export const DERIVATIONS: Record<DerivationId, (output: string, lang: OutputLanguage) => string> = {
  "question-plan": questionPlan,
};
