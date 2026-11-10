import type { PromptDef } from "./types";
import nl from "./files/agent-student.nl.md?raw";
import en from "./files/agent-student.en.md?raw";

/**
 * SOURCE: Original LimeOnIt instrument (plan "Nieuwe rolagenten", BESLUIT-2026-11-10-1), not
 * from The Pedagogical Promptbook. The student reviewer reads the same course message as the
 * other reviewers, week by week, for clarity, coinciding deadlines and timely feedback.
 */
export const AGENT_STUDENT_PROMPT: PromptDef = {
  id: "agent-student@v1",
  verbatim:
    "You read a colleague's whole course as a student going through it week by week. Look for summative deadlines that fall in the same week, feedback that comes only once the work already counts, empty weeks followed by a final sprint, and summative work without a week or a clear title. Leave hours and build-up to the Designer, wording and assessment form to the Assessment expert. Do not repeat the fixed checks or rejected advice. Return at most eight findings as JSON, each pointing at an existing item. Invent nothing and do not speak for real students; an empty list is fine; the teacher decides.",
  runtime: { nl, en },
};
