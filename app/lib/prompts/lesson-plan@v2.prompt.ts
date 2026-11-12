import type { PromptDef } from "./types";
import en from "./files/lesson-plan@v2.en.md?raw";
import nl from "./files/lesson-plan@v2.nl.md?raw";
import { LESSON_PLAN_PROMPT } from "./lesson-plan@v1.prompt";

/**
 * SOURCE: Original LimeOnIt tool, see `lesson-plan@v1.prompt.ts`.
 *
 * What @v2 changes (BESLUIT-2026-11-12-13, P30.4): a lesson plan can become slides, and the list
 * items of a phase are the points on a slide students see. So an expected answer never shares a
 * list item with its question: the answers follow the list in their own paragraph
 * ("Verwachte antwoorden:" / "Expected answers:"), which the deck puts in the speaker notes.
 */
export const LESSON_PLAN_PROMPT_V2: PromptDef = {
  id: "lesson-plan@v2",
  verbatim: LESSON_PLAN_PROMPT.verbatim,
  runtime: { nl, en },
};
