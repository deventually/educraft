import type { PromptDef } from "./types";
import en from "./files/defense-review.en.md?raw";
import nl from "./files/defense-review.nl.md?raw";
import verbatim from "./book/defense-review.md?raw";

/**
 * SOURCE: Andy Van Schaack & Roman Sarlo, "From Oracle to Socratic Partner: Redesigning
 * Instruction with AI Through the Science of Learning", in The Pedagogical Promptbook
 * (ed. D. Wiley), CC BY 4.0. `verbatim` (book/defense-review.md) is the book's prompt, word
 * for word: Appendix F.4, the Transcript Analyst Prompt of Worked Example 2 "Lab Oral Defense",
 * printed pp. 352–353.
 *
 * Brief P31, 31.2. What LimeOnIt changed is in the tool's Attribution.adaptation: the chemistry
 * criteria become general criteria for own work (or the teacher's), the transcript is
 * anonymised in the browser first (BESLUIT-2026-11-07-2), and what the AI said never counts.
 */
export const DEFENSE_REVIEW_PROMPT: PromptDef = {
  id: "defense-review@v1",
  verbatim,
  runtime: { nl, en },
};
