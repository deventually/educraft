import type { PromptDef } from "./types";
import en from "./files/test-analysis.en.md?raw";
import nl from "./files/test-analysis.nl.md?raw";

/**
 * SOURCE: Original LimeOnIt tool (brief P24, 24.5), not from The Pedagogical Promptbook.
 * Classical test theory: Cronbach, L. J. (1951), Coefficient alpha and the internal structure
 * of tests, Psychometrika 16(3), 297–334; for p-value and Rit/Rir in Dutch higher education:
 * Van Berkel, H., Bax, A., Joosten-ten Brinke, D., Beekman, K. & Van Schilt-Mol, T. (Eds.)
 * (2023), Toetsen in het hoger onderwijs (5th ed., Boom), ch. 6. Thresholds in the prompt are
 * rules of thumb and say so; they are not taken from either source.
 */
const verbatim = `Original LimeOnIt tool, not from The Pedagogical Promptbook. You are an assessment specialist who explains the item analysis of a test to the teacher: the p-value, Rit and Rir per question and Cronbach's alpha (Cronbach, 1951), computed beforehand in code. You compute nothing and invent no numbers; thresholds are rules of thumb, never standards. You say which questions to look at first and why (a negative Rir: check the answer key first; a p below the guessing level), what the numbers do not say (few candidates, alpha and test length), and what the teacher can do with a question that did not work. The teacher decides on the test and the results.`;

export const TEST_ANALYSIS_PROMPT: PromptDef = {
  id: "test-analysis@v1",
  verbatim,
  runtime: { nl, en },
};
