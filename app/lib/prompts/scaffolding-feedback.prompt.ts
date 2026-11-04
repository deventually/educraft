import type { PromptDef } from "./types";
import nl from "./files/scaffolding-feedback.nl.md?raw";
import en from "./files/scaffolding-feedback.en.md?raw";
import verbatim from "./book/scaffolding-feedback.md?raw";

/**
 * SOURCE: April Crenshaw, LeAnders Burns & David Escalante Gonzalez, "Scaffolding with Formative Feedback: A Deployable AI Tutoring Prompt System", in The Pedagogical Promptbook (ed. D. Wiley), CC BY 4.0.
 * `verbatim` (book/scaffolding-feedback.md) is the book's prompt, word for word: Appendix A "Prompt Architecture", printed pp. 279–283 (the Step-by-Step mode for Unit 1). One line on p. 281/282 is missing from the PDF text layer; it is marked […].
 *
 * What LimeOnIt changed is in the tool's Attribution.adaptation. The runtime
 * variants (per language) live in files/scaffolding-feedback.{nl,en}.md.
 */
export const SCAFFOLDING_FEEDBACK_PROMPT: PromptDef = {
  id: "scaffolding-feedback@v1",
  verbatim,
  runtime: { nl, en },
};
