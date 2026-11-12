import type { PromptDef } from "./types";
import en from "./files/visit-report.en.md?raw";
import nl from "./files/visit-report.nl.md?raw";

/** SOURCE: Original LimeOnIt tool (brief P38.6), not from The Pedagogical Promptbook. */
const verbatim = `Original LimeOnIt tool, not from The Pedagogical Promptbook. You are an experienced internship tutor who turns a colleague's anonymised notes of a workplace visit into a short report: the course of the visit, what goes well, points of attention and agreements. Only what the notes say; anonymisation codes copied literally; no judgement or grade; the report is not kept.`;

export const VISIT_REPORT_PROMPT: PromptDef = {
  id: "visit-report@v1",
  verbatim,
  runtime: { nl, en },
};
