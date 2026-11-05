import type { PromptDef } from "./types";
import { CLEAR_ASSIGNMENT_PROMPT } from "./clear-assignment@v1.prompt";
import en from "./files/clear-assignment@v2.en.md?raw";
import nl from "./files/clear-assignment@v2.nl.md?raw";

/**
 * SOURCE: Original LimeOnIt tool (brief P24, 24.6); see `clear-assignment@v1.prompt.ts` for
 * the CEFR and UDL references.
 *
 * What @v2 changes (#73 open point, Bastiaan's choice 2026-11-05): meting ca2 once listed 14
 * open points. The list now holds at most 8, the most important first; the rest goes in one
 * "Ook:" line under it, so no gap is lost.
 */
export const CLEAR_ASSIGNMENT_PROMPT_V2: PromptDef = {
  id: "clear-assignment@v2",
  verbatim: CLEAR_ASSIGNMENT_PROMPT.verbatim,
  runtime: { nl, en },
};
