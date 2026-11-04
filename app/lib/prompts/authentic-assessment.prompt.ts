import type { PromptDef } from "./types";
import nl from "./files/authentic-assessment.nl.md?raw";
import en from "./files/authentic-assessment.en.md?raw";
import verbatim from "./book/authentic-assessment.md?raw";

/**
 * SOURCE: Rebecca McNulty, Wendy Howard & Roslyn Miller, "Backward Design: Using Structured Frameworks to Develop Authentic Assessment Opportunities", in The Pedagogical Promptbook (ed. D. Wiley), CC BY 4.0.
 * `verbatim` (book/authentic-assessment.md) is the book's prompt, word for word: Appendix A, printed pp. 161–165.
 *
 * What LimeOnIt changed is in the tool's Attribution.adaptation. The runtime
 * variants (per language) live in files/authentic-assessment.{nl,en}.md.
 */
export const AUTHENTIC_ASSESSMENT_PROMPT: PromptDef = {
  id: "authentic-assessment@v1",
  verbatim,
  runtime: { nl, en },
};
