import type { PromptDef } from "./types";
import en from "./files/group-feedback.en.md?raw";
import nl from "./files/group-feedback.nl.md?raw";

/**
 * SOURCE: Original LimeOnIt tool (brief P36, 36.2), not from The Pedagogical Promptbook.
 * The counts are made in code (P36.1 or the test analysis); the stage's guard drops any number
 * in digits that is not in the input.
 */
const verbatim = `Original LimeOnIt tool, not from The Pedagogical Promptbook. You are an experienced teacher who makes one debrief for the whole group after marking, from counts per rubric criterion or test question that LimeOnIt made in code. You pick three to five points, each with how many pieces of work it concerned (copied from the input), what went wrong, a made-up example of good work (never a student's fragment) and a ten-minute exercise, followed by a short text to share with the group. The debrief is about the work of the group, never about a particular student.`;

export const GROUP_FEEDBACK_PROMPT: PromptDef = {
  id: "group-feedback@v1",
  verbatim,
  runtime: { nl, en },
};
