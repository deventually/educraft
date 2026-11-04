import type { PromptDef } from "./types";
import nl from "./files/contextualization.nl.md?raw";
import en from "./files/contextualization.en.md?raw";
import verbatim from "./book/contextualization.md?raw";

/**
 * SOURCE: Alexis Guethler, "Making Pedagogical Intent Visible: AI-Supported Contextualization in Higher Education Course Design", in The Pedagogical Promptbook (ed. D. Wiley), CC BY 4.0.
 * `verbatim` (book/contextualization.md) is the book's prompt, word for word: Appendix 1 "Final Version of Prompt", from the web edition (edtechbooks.org/promptbook/making-pedagogical-intent-visible, doi.org/10.59668/2340.26734); the chapter is missing from the book PDF, and the web edition has no page numbers.
 *
 * What LimeOnIt changed is in the tool's Attribution.adaptation. The runtime
 * variants (per language) live in files/contextualization.{nl,en}.md.
 */
export const CONTEXTUALIZATION_PROMPT: PromptDef = {
  id: "contextualization@v1",
  verbatim,
  runtime: { nl, en },
};
