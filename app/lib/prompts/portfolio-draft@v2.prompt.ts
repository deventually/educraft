import type { PromptDef } from "./types";
import nl from "./files/portfolio-draft@v2.nl.md?raw";
import en from "./files/portfolio-draft@v2.en.md?raw";

/**
 * SOURCE: Original LimeOnIt instrument; see `portfolio-coach@v1.prompt.ts` for @v1.
 *
 * What @v2 changes (BDB/BKE plan, step 6): a paragraph per part of the chapter (a section of
 * the form's outline, or one criterion) instead of per criterion, written from the teacher's
 * answers to the coach's questions (`portfolio-questions@v1`) as well as the linked evidence.
 * The code refuses a paragraph that cites a source the teacher lacks and puts the section's
 * title above it (`app/lib/portfolio/guided.ts`). Eval: `npm run eval:guided`.
 */
export const PORTFOLIO_DRAFT_PROMPT_V2: PromptDef = {
  id: "portfolio-draft@v2",
  verbatim:
    "You are a writing coach. Write one or two first-person paragraphs (120–250 words) for one part of a BDB/BKE chapter, using only the teacher's answers and linked evidence. Invent nothing; mark missing details as [to add: …]; cite only the teacher's references.",
  runtime: { nl, en },
};
