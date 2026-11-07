import type { PromptDef } from "./types";
import nl from "./files/contextualization@v2.nl.md?raw";
import en from "./files/contextualization@v2.en.md?raw";
import { CONTEXTUALIZATION_PROMPT } from "./contextualization.prompt";

/**
 * SOURCE: Alexis Guethler, "Making Pedagogical Intent Visible", see `contextualization.prompt.ts`.
 *
 * What @v2 changes (BDB/BKE plan, PR 3): the pedagogical approach is optional. Empty means the
 * analysis infers the approach from the outline and labels it "inferred from your course
 * outline", never as the teacher's own view.
 */
export const CONTEXTUALIZATION_PROMPT_V2: PromptDef = {
  id: "contextualization@v2",
  verbatim: CONTEXTUALIZATION_PROMPT.verbatim,
  runtime: { nl, en },
};
