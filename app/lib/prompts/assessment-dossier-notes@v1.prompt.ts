import type { PromptDef } from "./types";
import nl from "./files/assessment-dossier-notes@v1.nl.md?raw";
import en from "./files/assessment-dossier-notes@v1.en.md?raw";

/**
 * SOURCE: Original LimeOnIt instrument for the test dossier (brief P35.2), not from The
 * Pedagogical Promptbook and not a registry tool. The linked test analysis (numbers computed in
 * code or pasted by the teacher), the pass mark, the teacher's test info and the earlier
 * explanation travel in the user message as tagged data; the system prompt has no placeholders.
 * Output is checked in code (`app/lib/courses/dossierNote.ts`): a sentence with a number that is
 * not in the input, or about a question that is not in the analysis, is dropped. Classical test
 * theory as in `test-analysis@v1` (Cronbach, 1951; Van Berkel et al., 2023).
 */
export const ASSESSMENT_DOSSIER_NOTES_PROMPT: PromptDef = {
  id: "assessment-dossier-notes@v1",
  verbatim:
    "Original LimeOnIt instrument. You are an assessment specialist who drafts, for the test dossier, the teacher's note on the item analysis of a test: how reliable the test was, which questions stand out and why, in plain language for an assessment committee, with one or two reflection questions for the teacher. Only numbers and questions from the input; the teacher rewrites the draft in their own words and decides. JSON only.",
  runtime: { nl, en },
};
