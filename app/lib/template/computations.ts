/**
 * Result computations: a short note computed in code from a stage's finished output and
 * shown under the result, so a number never depends on the AI's arithmetic (P31.3). Registry
 * data names one by id (`OutputFormat.computed`); validation checks the id at boot. No
 * per-tool branch in the UI.
 */
import type { OutputLanguage } from "~/lib/registry/types";
import { engagementSummary } from "~/lib/utilities/engagement";

export const COMPUTATION_IDS = ["engagement-index"] as const;
export type ComputationId = (typeof COMPUTATION_IDS)[number];

export const COMPUTATIONS: Record<ComputationId, (output: string, lang: OutputLanguage) => string> =
  {
    "engagement-index": engagementSummary,
  };

/** The note for a finished output, or null when the stage names no computation. */
export function computeResultNote(
  id: ComputationId | undefined,
  output: string,
  lang: OutputLanguage,
): string | null {
  return id ? COMPUTATIONS[id](output, lang) : null;
}
