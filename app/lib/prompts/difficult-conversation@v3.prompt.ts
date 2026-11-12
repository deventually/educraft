import type { PromptDef } from "./types";
import en from "./files/difficult-conversation@v3.en.md?raw";
import nl from "./files/difficult-conversation@v3.nl.md?raw";
import { DIFFICULT_CONVERSATION_PROMPT } from "./difficult-conversation@v1.prompt";

/**
 * SOURCE: Original LimeOnIt tool (brief P24, 24.8); see `difficult-conversation@v1.prompt.ts`
 * for the SPIKES reference.
 *
 * What @v3 changes (brief P39, 39.1): two conversations of study career coaching,
 * `negative-study-advice` (bad news, so SPIKES) and `dropout` (general technique). A new bound:
 * no advice on the BSA decision, in the role or in the feedback; the programme takes it.
 */
export const DIFFICULT_CONVERSATION_PROMPT_V3: PromptDef = {
  id: "difficult-conversation@v3",
  verbatim: DIFFICULT_CONVERSATION_PROMPT.verbatim,
  runtime: { nl, en },
};
