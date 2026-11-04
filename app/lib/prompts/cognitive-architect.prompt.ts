import type { PromptDef } from "./types";
import analystNl from "./files/cognitive-architect-analyst.nl.md?raw";
import analystEn from "./files/cognitive-architect-analyst.en.md?raw";
import generatorNl from "./files/cognitive-architect-generator.nl.md?raw";
import generatorEn from "./files/cognitive-architect-generator.en.md?raw";
import validatorNl from "./files/cognitive-architect-validator.nl.md?raw";
import validatorEn from "./files/cognitive-architect-validator.en.md?raw";
import analystGenNl from "./files/cognitive-architect-analyst-gen.nl.md?raw";
import analystGenEn from "./files/cognitive-architect-analyst-gen.en.md?raw";
import analystVerbatim from "./book/cognitive-architect-analyst.md?raw";
import generatorVerbatim from "./book/cognitive-architect-generator.md?raw";
import validatorVerbatim from "./book/cognitive-architect-validator.md?raw";
import analystGenVerbatim from "./book/cognitive-architect-analyst-gen.md?raw";

/**
 * SOURCE: Andy Van Schaack & Roman Sarlo, "From Oracle to Socratic Partner:
 * Redesigning Instruction with AI Through the Science of Learning", in The
 * Pedagogical Promptbook (ed. D. Wiley), CC BY 4.0: the four-stage "Cognitive
 * Architect", Appendices A–D, printed pp. 324–338. Model-agnostic ("Claude, GPT-4,
 * or equivalent"). The verbatim files in book/ are each appendix's prompt, word for
 * word: A The Instructional Analyst (pp. 324–328), B The Student Prompt Generator
 * (pp. 329–331), C The Quality Validator (pp. 332–334), D The Transcript Analyst
 * Generator (pp. 335–338).
 *
 * Each stage's runtime variants live in files/cognitive-architect-<stage>.{nl,en}.md.
 */
export const COGNITIVE_ARCHITECT_ANALYST: PromptDef = {
  id: "cognitive-architect-analyst@v1",
  verbatim: analystVerbatim,
  runtime: { nl: analystNl, en: analystEn },
};
export const COGNITIVE_ARCHITECT_GENERATOR: PromptDef = {
  id: "cognitive-architect-generator@v1",
  verbatim: generatorVerbatim,
  runtime: { nl: generatorNl, en: generatorEn },
};
export const COGNITIVE_ARCHITECT_VALIDATOR: PromptDef = {
  id: "cognitive-architect-validator@v1",
  verbatim: validatorVerbatim,
  runtime: { nl: validatorNl, en: validatorEn },
};
export const COGNITIVE_ARCHITECT_ANALYST_GEN: PromptDef = {
  id: "cognitive-architect-analyst-gen@v1",
  verbatim: analystGenVerbatim,
  runtime: { nl: analystGenNl, en: analystGenEn },
};
