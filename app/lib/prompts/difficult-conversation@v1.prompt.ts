import type { PromptDef } from "./types";
import en from "./files/difficult-conversation.en.md?raw";
import nl from "./files/difficult-conversation.nl.md?raw";

/**
 * SOURCE: Original LimeOnIt tool (brief P24, 24.8), not from The Pedagogical
 * Promptbook. The feedback on bad-news conversations follows the six steps of SPIKES in
 * Baile, W. F., Buckman, R., Lenzi, R., Glober, G., Beale, E. A., & Kudelka, A. P. (2000),
 * SPIKES—A Six-Step Protocol for Delivering Bad News: Application to the Patient with
 * Cancer, The Oncologist 5(4), 302–311. The other conversations get general conversation
 * technique without a model name.
 */
const verbatim = `Original LimeOnIt tool, not from The Pedagogical Promptbook. You play a fictional student in a difficult conversation the teacher chooses (study progress and study advice, bad news about an assessment, a suspicion of fraud, a student who is stuck), realistic but not hostile without a reason, and you stay in the role until the teacher asks for feedback. Then you step out of the role and give feedback that quotes what the teacher really said: what went well, what could be better with a sentence the teacher could have said instead, for bad news the six steps of SPIKES (Baile et al., 2000), and one thing to practise. No legal or medical advice, no real student data, invent nothing.`;

export const DIFFICULT_CONVERSATION_PROMPT: PromptDef = {
  id: "difficult-conversation@v1",
  verbatim,
  runtime: { nl, en },
};
