import type { PromptDef } from "./types";
import nl from "./files/portfolio-questions@v2.nl.md?raw";
import en from "./files/portfolio-questions@v2.en.md?raw";

/**
 * SOURCE: Original LimeOnIt instrument; see `portfolio-questions@v1.prompt.ts` for @v1.
 *
 * What @v2 changes: the message may hold `<course>`, the facts the teacher recorded in the
 * anchor's course (`app/lib/portfolio/courseFacts.ts`): the module, the schedule, the lesson or
 * the test. The coach does not ask for those again, only for the why behind them. Eval:
 * `npm run eval:guided`.
 */
export const PORTFOLIO_QUESTIONS_PROMPT_V2: PromptDef = {
  id: "portfolio-questions@v2",
  verbatim:
    "You are a writing coach. Ask two to four open questions about the teacher's own practice for one part of a BDB/BKE chapter, about what its criteria require and the evidence and the course's facts do not yet show. Do not ask for what the course already says. No yes/no questions; answer nothing yourself; invent nothing. JSON only.",
  runtime: { nl, en },
};
