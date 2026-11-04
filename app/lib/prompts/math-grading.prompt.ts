import type { PromptDef } from "./types";
import nl from "./files/math-grading.nl.md?raw";
import en from "./files/math-grading.en.md?raw";
import verbatim from "./book/math-grading.md?raw";

/**
 * SOURCE: Alberto Gandolfi, Jonas Saman & Eleni Tesfaye, "Leveraging LLMs for Grading and Feedback on Handwritten Math Assessment Responses", in The Pedagogical Promptbook (ed. D. Wiley), CC BY 4.0.
 * `verbatim` (book/math-grading.md) is the book's prompt, word for word: Appendix "Final Version of Prompt", printed pp. 143–145.
 *
 * What LimeOnIt changed is in the tool's Attribution.adaptation. The runtime
 * variants (per language) live in files/math-grading.{nl,en}.md.
 */
export const MATH_GRADING_PROMPT: PromptDef = {
  id: "math-grading@v1",
  verbatim,
  runtime: { nl, en },
};
