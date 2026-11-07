import type { PromptDef } from "./types";
import nl from "./files/cognitive-architect-analyst@v2.nl.md?raw";
import en from "./files/cognitive-architect-analyst@v2.en.md?raw";
import { COGNITIVE_ARCHITECT_ANALYST } from "./cognitive-architect.prompt";

/**
 * SOURCE: Appendix A of "From Oracle to Socratic Partner", see `cognitive-architect.prompt.ts`.
 *
 * What @v2 changes (BDB/BKE plan, PR 3): the legacy activity is optional. Empty means a new
 * design: the analyst invents no existing activity and gives no CEI or ratings, and picks the
 * Priority Principles from what this objective, phase and material easily leave underused.
 * Only the analyst changes; the other three stages stay on @v1.
 */
export const COGNITIVE_ARCHITECT_ANALYST_V2: PromptDef = {
  id: "cognitive-architect-analyst@v2",
  verbatim: COGNITIVE_ARCHITECT_ANALYST.verbatim,
  runtime: { nl, en },
};
