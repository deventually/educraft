import type { PromptDef } from "./types";
import en from "./files/portfolio-framework@v2.en.md?raw";
import nl from "./files/portfolio-framework@v2.nl.md?raw";
import { PORTFOLIO_FRAMEWORK_PROMPT } from "./portfolio-framework@v1.prompt";

/**
 * SOURCE: Original LimeOnIt instrument (brief P25, 25.4); see
 * `portfolio-framework@v1.prompt.ts`.
 *
 * What @v2 changes (BDB/BKE plan, step 5): besides the framework, the form's
 * chapter outline per outcome (sections, what each asks, the numbers of the
 * criteria it covers) and the literature the form names. No outline when the
 * form gives none; the code flags a section name and drops a source that are
 * not in the form (`app/lib/portfolio/extract.ts`). Eval: `npm run eval:framework`.
 */
export const PORTFOLIO_FRAMEWORK_PROMPT_V2: PromptDef = {
  id: "portfolio-framework@v2",
  verbatim: PORTFOLIO_FRAMEWORK_PROMPT.verbatim,
  runtime: { nl, en },
};
