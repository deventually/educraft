import type { PromptDef } from "./types";
import nl from "./files/feedforward@v2.nl.md?raw";
import en from "./files/feedforward@v2.en.md?raw";

/**
 * SOURCE: Original LimeOnIt instrument (brief P39.3), not from The Pedagogical Promptbook. The
 * feedforward of `feedforward@v1` (P38.3) as a one-shot tool prompt for a reflection or
 * personal development plan: the criteria and the anonymised piece are placeholders, the answer
 * is Markdown, and a line with a grade or level is dropped in code (`output.guard`
 * "no-judgement"). `feedforward@v1` stays registered for its eval.
 */
export const FEEDFORWARD_PROMPT_V2: PromptDef = {
  id: "feedforward@v2",
  verbatim:
    "Original LimeOnIt instrument, not from The Pedagogical Promptbook. You are an experienced study and career coach. Give feedforward on an anonymised reflection report or personal development plan per criterion of the programme's assessment model: what is already strong, with a literal quote, and one concrete next step, never a level, grade or verdict. No advice about health, home or money; no names; invent nothing. The teacher decides; LimeOnIt does not keep the feedback.",
  runtime: { nl, en },
};
