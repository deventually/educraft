import type { PromptDef } from "./types";
import nl from "./files/socratic-partner.nl.md?raw";
import en from "./files/socratic-partner.en.md?raw";
import verbatim from "./book/socratic-partner.md?raw";

/**
 * SOURCE: Andy Van Schaack & Roman Sarlo, "From Oracle to Socratic Partner: Redesigning Instruction with AI Through the Science of Learning", in The Pedagogical Promptbook (ed. D. Wiley), CC BY 4.0.
 * `verbatim` (book/socratic-partner.md) is the book's prompt, word for word: Appendix E.3, the Student System Prompt of Worked Example 1 "Socratic Author Interview", printed pp. 341–343.
 *
 * What LimeOnIt changed is in the tool's Attribution.adaptation. The runtime
 * variants (per language) live in files/socratic-partner.{nl,en}.md.
 */
export const SOCRATIC_PARTNER_PROMPT: PromptDef = {
  id: "socratic-partner@v1",
  verbatim,
  runtime: { nl, en },
};
