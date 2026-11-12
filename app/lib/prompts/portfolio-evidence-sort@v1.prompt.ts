import type { PromptDef } from "./types";
import nl from "./files/portfolio-evidence-sort.nl.md?raw";
import en from "./files/portfolio-evidence-sort.en.md?raw";

/**
 * SOURCE: Original LimeOnIt instrument for the BDB/BKE workplace (advice "vereenvoudigen",
 * point 3: evidence in one go), not from The Pedagogical Promptbook and not a registry tool.
 * One file and the keyed framework travel in the user message as tagged data; the system
 * prompt has no placeholders. Output is checked in code (`app/lib/portfolio/batch.ts`): only
 * keys of the chosen outcome survive, and doubt or a correction becomes "Controleren".
 * Eval: `npm run eval:evidence`.
 */
export const PORTFOLIO_EVIDENCE_SORT_PROMPT: PromptDef = {
  id: "portfolio-evidence-sort@v1",
  verbatim:
    "You help a teacher sort BDB/BKE evidence. For one file, propose the learning outcome, the kind, the criteria it shows and the required-evidence line it fills, using only keys from the framework. Say when you doubt. Only a proposal; no verdict; no names. JSON only.",
  runtime: { nl, en },
};
