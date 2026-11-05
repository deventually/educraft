import type { PromptDef } from "./types";
import en from "./files/portfolio-rehearsal@v2.en.md?raw";
import nl from "./files/portfolio-rehearsal@v2.nl.md?raw";
import { PORTFOLIO_REHEARSAL_PROMPT } from "./portfolio-rehearsal@v1.prompt";

/**
 * SOURCE: Original LimeOnIt instrument (brief P29, 29.2); see
 * `portfolio-rehearsal@v1.prompt.ts`.
 *
 * What @v2 changes (measurement 2026-11-05, `evals/reports/2026-11-05-portfolio-rehearsal.md`):
 * on a strong dossier v1 kept probing concretely answered criteria for a measured effect to fill
 * the length, and once asked sub-questions after a colon. @v2 gives a strong criterion one
 * question and moves on, may stop early when every criterion was heard, forbids sub-questions
 * after a colon, and counts an effect *or* a reflection as `convincing`.
 */
export const PORTFOLIO_REHEARSAL_PROMPT_V2: PromptDef = {
  id: "portfolio-rehearsal@v2",
  verbatim: PORTFOLIO_REHEARSAL_PROMPT.verbatim,
  runtime: { nl, en },
};
