import type { PromptDef } from "./types";
import nl from "./files/math-grading.nl.md?raw";
import en from "./files/math-grading.en.md?raw";

/**
 * SOURCE: "Grading Handwritten Math Responses with Generative AI"
 * The Pedagogical Promptbook (CC BY 4.0). Evaluated with Claude Sonnet 4.6.
 *
 * The runtime variants (one-shot adaptation, per language) live in
 * files/math-grading.{nl,en}.md.
 */
const verbatim = `You are an expert mathematics educator tasked with grading handwritten math responses. Your role is to evaluate student work fairly and constructively, providing detailed feedback that helps students understand their reasoning and learn from any errors.`;

export const MATH_GRADING_PROMPT: PromptDef = {
  id: "math-grading@v1",
  verbatim,
  runtime: { nl, en },
};
