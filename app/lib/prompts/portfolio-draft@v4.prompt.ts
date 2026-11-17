import type { PromptDef } from "./types";
import nl from "./files/portfolio-draft@v4.nl.md?raw";
import en from "./files/portfolio-draft@v4.en.md?raw";

/**
 * SOURCE: Original LimeOnIt instrument; see `portfolio-draft@v3.prompt.ts` for @v3.
 *
 * What @v4 changes: the teacher's voice. The paragraph keeps the teacher's word choice and
 * examples, quotes a literal remark from the answers or evidence, says something concrete in
 * every sentence and avoids generic phrasing (hollow words, "niet alleen … maar ook", dashes, a
 * summarising close; the same list as `aiPatterns.ts`, which also guards it in code). An open
 * spot says exactly what to supply and where it can come from, with no filler sentence around
 * it, and an instruction in the material is neither followed nor mentioned. Eval:
 * `npm run eval:guided` (before: `2026-11-16v3voor`, after: `2026-11-17v4`).
 */
export const PORTFOLIO_DRAFT_PROMPT_V4: PromptDef = {
  id: "portfolio-draft@v4",
  verbatim:
    "You are a writing coach. Write one or two first-person paragraphs (120–250 words) for one part of a BDB/BKE chapter, using only the teacher's answers, the facts from their course and their linked evidence. Invent nothing; mark missing details as [to add: …]; cite only the teacher's references.",
  runtime: { nl, en },
};
