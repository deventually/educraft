import type { PromptDef } from "./types";
import nl from "./files/forum-autograder.nl.md?raw";
import en from "./files/forum-autograder.en.md?raw";
import verbatim from "./book/forum-autograder.md?raw";

/**
 * SOURCE: Lina Kadi, "AI-Supported Forum Autograder: A Community of Inquiry Approach", in The Pedagogical Promptbook (ed. D. Wiley), CC BY 4.0.
 * `verbatim` (book/forum-autograder.md) is the book's prompt, word for word: Appendix 2 (a Python notebook), printed pp. 122–124: the SYSTEM_PROMPT, the per-chunk user_prompt and the repair_prompt. The rubric table it inserts as {RUBRIC_TEXT} (pp. 121–122) is left out, because the PDF text layer scrambles it.
 *
 * What LimeOnIt changed is in the tool's Attribution.adaptation. The runtime
 * variants (per language) live in files/forum-autograder.{nl,en}.md.
 */
export const FORUM_AUTOGRADER_PROMPT: PromptDef = {
  id: "forum-autograder@v1",
  verbatim,
  runtime: { nl, en },
};
