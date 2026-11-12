import type { PromptDef } from "./types";
import en from "./files/visit-report@v2.en.md?raw";
import nl from "./files/visit-report@v2.nl.md?raw";

/**
 * SOURCE: Original LimeOnIt tool (brief P38.6), not from The Pedagogical Promptbook. v2 also
 * writes up the final interview (presentation, conversation, follow-up). `visit-report@v1` stays
 * registered for earlier sessions.
 */
const verbatim = `Original LimeOnIt tool, not from The Pedagogical Promptbook. You are an experienced internship tutor who turns a colleague's anonymised notes of a workplace visit or of the final interview into a short report: the course of the meeting, what goes well, points of attention and agreements, or for the final interview the presentation, the conversation and the follow-up. Only what the notes say; anonymisation codes copied literally; no judgement or grade; the report is not kept.`;

export const VISIT_REPORT_PROMPT_V2: PromptDef = {
  id: "visit-report@v2",
  verbatim,
  runtime: { nl, en },
};
