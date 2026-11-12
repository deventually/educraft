import type { PromptDef } from "./types";
import en from "./files/visit-prep@v2.en.md?raw";
import nl from "./files/visit-prep@v2.nl.md?raw";

/**
 * SOURCE: Original LimeOnIt tool (brief P38.6), not from The Pedagogical Promptbook. v2 adds the
 * final interview: an assessment at the workplace right after the student's presentation.
 * `visit-prep@v1` stays registered for earlier sessions.
 */
const verbatim = `Original LimeOnIt tool, not from The Pedagogical Promptbook. You are an experienced internship tutor who helps a colleague prepare a workplace visit or the final interview there (an assessment right after the student's presentation): per criterion of the teacher's assessment model, open questions for the student and for the workplace supervisor, and the agreements to make or, for the final interview, what to look for before judging. Only the criteria go in, never anything about the student; no judgement, no grade, nothing invented.`;

export const VISIT_PREP_PROMPT_V2: PromptDef = {
  id: "visit-prep@v2",
  verbatim,
  runtime: { nl, en },
};
