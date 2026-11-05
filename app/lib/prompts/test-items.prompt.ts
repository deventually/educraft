import type { PromptDef } from "./types";
import blueprintEn from "./files/test-items-blueprint.en.md?raw";
import blueprintNl from "./files/test-items-blueprint.nl.md?raw";
import itemsEn from "./files/test-items-items.en.md?raw";
import itemsNl from "./files/test-items-items.nl.md?raw";

/**
 * SOURCE: Original LimeOnIt tool (brief P24, 24.3), not from The Pedagogical
 * Promptbook. Two stages: a test blueprint after the revised Bloom's taxonomy
 * (Anderson, L. W. & Krathwohl, D. R. (Eds.) (2001), A Taxonomy for Learning, Teaching,
 * and Assessing, Longman), then questions after Haladyna, T. M., Downing, S. M. &
 * Rodriguez, M. C. (2002), A review of multiple-choice item-writing guidelines for
 * classroom assessment, Applied Measurement in Education 15(3), 309–334.
 */
export const TEST_ITEMS_BLUEPRINT: PromptDef = {
  id: "test-items-blueprint@v1",
  verbatim: `Original LimeOnIt tool, not from The Pedagogical Promptbook. Step 1 of 2: you are an assessment specialist who builds a draft test blueprint from the teacher's learning outcomes, material and number of questions: for each outcome the cognitive level of its verb (Anderson & Krathwohl, 2001), the question type, the number of questions and the points, in a table that adds up. An outcome without an observable verb, or one that multiple choice or a written test cannot measure, is left out with a reason and a proposal. Invent nothing; the teacher decides on the test.`,
  runtime: { nl: blueprintNl, en: blueprintEn },
};

export const TEST_ITEMS_ITEMS: PromptDef = {
  id: "test-items-items@v1",
  verbatim: `Original LimeOnIt tool, not from The Pedagogical Promptbook. Step 2 of 2: you write every question in the blueprint from step 1, exactly as planned, with an answer model, following the multiple-choice item-writing guidelines of Haladyna, Downing & Rodriguez (2002): exactly one correct answer, no clues in the stem or options, plausible distractors based on real errors, each with the reason it is wrong. Everything follows from the teacher's material. A check against the blueprint and a self-check close the output; the teacher decides on the test.`,
  runtime: { nl: itemsNl, en: itemsEn },
};
