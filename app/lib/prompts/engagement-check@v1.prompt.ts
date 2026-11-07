import type { PromptDef } from "./types";
import verbatim from "./book/engagement-check.md?raw";
import en from "./files/engagement-check.en.md?raw";
import nl from "./files/engagement-check.nl.md?raw";

/**
 * SOURCE: Andy Van Schaack & Roman Sarlo, "From Oracle to Socratic Partner: Redesigning
 * Instruction with AI Through the Science of Learning", in The Pedagogical Promptbook
 * (ed. D. Wiley), CC BY 4.0: Appendix G, "Complete Cognitive Engagement Rubric
 * Definitions", printed pp. 355–356. The book gives the rubric, not a prompt; `verbatim`
 * is that appendix word for word. The runtime prompts carry the same rubric text verbatim
 * (in English, also in the Dutch prompt) and ask for a level per principle only: the total
 * is computed in code (`output.computed: "engagement-index"`, brief P31.3).
 */
export const ENGAGEMENT_CHECK_PROMPT: PromptDef = {
  id: "engagement-check@v1",
  verbatim,
  runtime: { nl, en },
};
