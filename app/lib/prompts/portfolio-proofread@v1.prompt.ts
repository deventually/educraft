import type { PromptDef } from "./types";
import nl from "./files/portfolio-proofread.nl.md?raw";
import en from "./files/portfolio-proofread.en.md?raw";

/**
 * SOURCE: Original LimeOnIt instrument for the BDB/BKE workplace, not from The
 * Pedagogical Promptbook and not a registry tool. The chapter travels in the
 * user message as tagged data; the system prompt has no placeholders. Output is
 * checked in code (`app/lib/portfolio/proofread.ts`): every proposal names a
 * span that is literally in the chapter, and cites no unknown source.
 */
export const PORTFOLIO_PROOFREAD_PROMPT: PromptDef = {
  id: "portfolio-proofread@v1",
  verbatim:
    "You are a copy editor. Proofread one chapter of a teacher's BDB/BKE report for spelling, grammar, style, first person, repetition, APA citations and consistency. Return at most twelve small proposals as JSON: a span copied verbatim from the chapter, the issue, a one-sentence explanation and a better version of exactly that span. Keep the teacher's voice and facts; add no content; an empty list is fine. The teacher decides.",
  runtime: { nl, en },
};
