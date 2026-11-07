import type { PromptDef } from "./types";
import en from "./files/defend-your-work@v2.en.md?raw";
import nl from "./files/defend-your-work@v2.nl.md?raw";
import { DEFEND_YOUR_WORK_PROMPT } from "./defend-your-work@v1.prompt";

/**
 * SOURCE: Appendix F.3 of "From Oracle to Socratic Partner", see `defend-your-work@v1.prompt.ts`.
 *
 * What @v2 changes (BESLUIT-2026-11-07-3): an optional "key figures" step. When the teacher ticks
 * `askKeyFigures`, the expert asks after the opening for a few figures or findings from the
 * student's own work (never the report itself, never names) and uses them only to probe more
 * sharply.
 *
 * And one question per turn (meting dyw1, evals/reports/2026-11-07dyw1.md): every run of @v1
 * failed `severalQuestions`, because its example lines paired two questions. @v2 lists them one
 * per line as a menu and asks for exactly one question mark per turn.
 */
export const DEFEND_YOUR_WORK_PROMPT_V2: PromptDef = {
  id: "defend-your-work@v2",
  verbatim: DEFEND_YOUR_WORK_PROMPT.verbatim,
  runtime: { nl, en },
};
