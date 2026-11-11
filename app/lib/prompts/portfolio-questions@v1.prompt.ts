import type { PromptDef } from "./types";
import nl from "./files/portfolio-questions.nl.md?raw";
import en from "./files/portfolio-questions.en.md?raw";

/**
 * SOURCE: Original LimeOnIt instrument for the BDB/BKE workplace (plan "BDB/BKE in een paar
 * dagen", step 6: guided writing per section), not from The Pedagogical Promptbook and not a
 * registry tool. The teacher's material travels in the user message as tagged data; the
 * system prompt has no placeholders. Output is checked in code (`app/lib/portfolio/guided.ts`):
 * two to four distinct questions, none citing an unknown source. Eval: `npm run eval:guided`.
 */
export const PORTFOLIO_QUESTIONS_PROMPT: PromptDef = {
  id: "portfolio-questions@v1",
  verbatim:
    "You are a writing coach. Ask two to four open questions about the teacher's own practice for one part of a BDB/BKE chapter, about what its criteria require and the evidence does not yet show. No yes/no questions; answer nothing yourself; invent nothing. JSON only.",
  runtime: { nl, en },
};
