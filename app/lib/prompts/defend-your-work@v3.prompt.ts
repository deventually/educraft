import type { PromptDef } from "./types";
import en from "./files/defend-your-work@v3.en.md?raw";
import nl from "./files/defend-your-work@v3.nl.md?raw";
import { DEFEND_YOUR_WORK_PROMPT } from "./defend-your-work@v1.prompt";

/**
 * SOURCE: Appendix F.3 of "From Oracle to Socratic Partner", see `defend-your-work@v1.prompt.ts`.
 *
 * What @v3 changes after @v2: no compound questions (meting dyw4,
 * evals/reports/2026-11-07dyw4.md). 95 of 215 expert turns joined two questions in one sentence
 * with ", and" ("Which error exactly, and what does it do to your result?"), and @v2 modeled that
 * very line itself. @v3 splits the example across two turns and forbids a second question after
 * ", and" or ", or" in the rule on one question per turn.
 */
export const DEFEND_YOUR_WORK_PROMPT_V3: PromptDef = {
  id: "defend-your-work@v3",
  verbatim: DEFEND_YOUR_WORK_PROMPT.verbatim,
  runtime: { nl, en },
};
