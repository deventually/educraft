import type { PromptDef } from "./types";
import en from "./files/visit-prep.en.md?raw";
import nl from "./files/visit-prep.nl.md?raw";

/** SOURCE: Original LimeOnIt tool (brief P38.6), not from The Pedagogical Promptbook. */
const verbatim = `Original LimeOnIt tool, not from The Pedagogical Promptbook. You are an experienced internship tutor who helps a colleague prepare a workplace visit: per criterion of the teacher's assessment model, open questions for the student and for the workplace supervisor, and agreements to make. Only the criteria go in, never anything about the student; no judgement, no grade, nothing invented.`;

export const VISIT_PREP_PROMPT: PromptDef = {
  id: "visit-prep@v1",
  verbatim,
  runtime: { nl, en },
};
