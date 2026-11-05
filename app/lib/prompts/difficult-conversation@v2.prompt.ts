import type { PromptDef } from "./types";
import en from "./files/difficult-conversation@v2.en.md?raw";
import nl from "./files/difficult-conversation@v2.nl.md?raw";
import { DIFFICULT_CONVERSATION_PROMPT } from "./difficult-conversation@v1.prompt";

/**
 * SOURCE: Original LimeOnIt tool (brief P24, 24.8); see `difficult-conversation@v1.prompt.ts`
 * for the SPIKES reference.
 *
 * What @v2 changes (#75 open point): the student's non-verbal cues switched between "haar" and
 * "zijn" within one conversation. A gender rule for the cues made the student correct itself
 * in plain view (meting dc2), so @v2 anchors one person instead: the cue is written in the
 * first person, in the student's own voice (*ik kijk naar de grond*).
 */
export const DIFFICULT_CONVERSATION_PROMPT_V2: PromptDef = {
  id: "difficult-conversation@v2",
  verbatim: DIFFICULT_CONVERSATION_PROMPT.verbatim,
  runtime: { nl, en },
};
