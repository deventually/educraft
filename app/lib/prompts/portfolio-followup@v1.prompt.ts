import type { PromptDef } from "./types";
import nl from "./files/portfolio-followup.nl.md?raw";
import en from "./files/portfolio-followup.en.md?raw";

/**
 * SOURCE: Original LimeOnIt instrument (guided writing, BDB/BKE). After the teacher answered
 * the coach's questions about one part, the coach follows up on vague or missing answers with
 * zero to two questions about the concrete moment, remark, number or evidence behind them, so
 * the paragraph can be built on the teacher's own specifics. Eval: `npm run eval:guided`.
 */
export const PORTFOLIO_FOLLOWUP_PROMPT: PromptDef = {
  id: "portfolio-followup@v1",
  verbatim:
    "You are a writing coach. Read the teacher's answers about one part of a BDB/BKE chapter and ask zero to two open follow-up questions about the concrete moment, remark, number or evidence behind an answer that is too vague. Ask nothing when the answers are concrete enough. Return JSON.",
  runtime: { nl, en },
};
