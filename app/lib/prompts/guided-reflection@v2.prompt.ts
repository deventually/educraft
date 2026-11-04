import { GUIDED_REFLECTION_PROMPT } from "./guided-reflection.prompt";
import type { PromptDef } from "./types";
import en from "./files/guided-reflection@v2.en.md?raw";
import nl from "./files/guided-reflection@v2.nl.md?raw";

/**
 * SOURCE: Benedict & Thayer, "Guided Reflection and Backward Design with Generative
 * AI", in The Pedagogical Promptbook (ed. D. Wiley), CC BY 4.0. Appendix "Final
 * Version of Prompt", printed pp. 78–79. `verbatim` is that prompt, the same text
 * @v1 already carried.
 *
 * What @v2 changes (BESLUIT-2026-11-04-22): the book's Steps 0–2 are the form, so the
 * runtime is Step 3, after "Proceed". The chapter's findings are written into it: the
 * three stages of Wiggins & McTighe as three separate parts, evidence kept apart from
 * activities (p. 74), the teacher's own words kept and vague input named with a marked
 * suggestion instead of the AI leading (pp. 71–72, 75–76), what worked before built on
 * (Step 2, a new optional field), and a length bound so the design is finished (our own
 * addition; the book sets no length). Dutch terms instead of "Alignment Summary".
 */
export const GUIDED_REFLECTION_PROMPT_V2: PromptDef = {
  id: "guided-reflection@v2",
  verbatim: GUIDED_REFLECTION_PROMPT.verbatim,
  runtime: { nl, en },
};
