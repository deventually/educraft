import type { PromptDef } from "./types";
import blueprintEn from "./files/test-items-blueprint.en.md?raw";
import blueprintNl from "./files/test-items-blueprint.nl.md?raw";
import itemsEn from "./files/test-items-items.en.md?raw";
import itemsNl from "./files/test-items-items.nl.md?raw";
import itemsV2En from "./files/test-items-items@v2.en.md?raw";
import itemsV2Nl from "./files/test-items-items@v2.nl.md?raw";
import itemsV3En from "./files/test-items-items@v3.en.md?raw";
import itemsV3Nl from "./files/test-items-items@v3.nl.md?raw";

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

/**
 * What @v2 changes (metingen t and u, STATUS.md "Later"): the stage gets a fixed plan per
 * question, computed in code from the blueprint table ({{questionPlan}}, derivation
 * "question-plan"), so it no longer works out the row of each question itself; and every
 * multiple-choice question has four options. @v1 stays registered for earlier results.
 */
export const TEST_ITEMS_ITEMS_V2: PromptDef = {
  id: "test-items-items@v2",
  verbatim: TEST_ITEMS_ITEMS.verbatim,
  runtime: { nl: itemsV2Nl, en: itemsV2En },
};

/**
 * What @v3 changes (metingen p, r2, u and w): the answer model is grouped per row, with the
 * row once in its own heading and only the number in each question heading. Under @v2 every
 * heading repeated "Row Rx", and the first question of a new row got the previous row by
 * carry-over ("Row R1 is not used; this is Row R2"). @v2 stays registered for earlier results.
 */
export const TEST_ITEMS_ITEMS_V3: PromptDef = {
  id: "test-items-items@v3",
  verbatim: TEST_ITEMS_ITEMS.verbatim,
  runtime: { nl: itemsV3Nl, en: itemsV3En },
};
