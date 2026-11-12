import type { PromptDef } from "./types";
import nl from "./files/portfolio-draft@v3.nl.md?raw";
import en from "./files/portfolio-draft@v3.en.md?raw";

/**
 * SOURCE: Original LimeOnIt instrument; see `portfolio-draft@v2.prompt.ts` for @v2.
 *
 * What @v3 changes: the message may hold `<course>`, the facts the teacher recorded in the
 * anchor's course (`app/lib/portfolio/courseFacts.ts`). The paragraph uses them literally where
 * the part asks for them, without an open spot, and lists no fact the part does not need. Eval:
 * `npm run eval:guided`.
 */
export const PORTFOLIO_DRAFT_PROMPT_V3: PromptDef = {
  id: "portfolio-draft@v3",
  verbatim:
    "You are a writing coach. Write one or two first-person paragraphs (120–250 words) for one part of a BDB/BKE chapter, using only the teacher's answers, the facts from their course and their linked evidence. Invent nothing; mark missing details as [to add: …]; cite only the teacher's references.",
  runtime: { nl, en },
};
