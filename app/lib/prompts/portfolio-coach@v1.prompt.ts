import type { PromptDef } from "./types";
import coachNl from "./files/portfolio-coach.nl.md?raw";
import coachEn from "./files/portfolio-coach.en.md?raw";
import draftNl from "./files/portfolio-draft.nl.md?raw";
import draftEn from "./files/portfolio-draft.en.md?raw";

/**
 * SOURCE: Original LimeOnIt instruments for the BDB/BKE workplace (brief P25,
 * 25.5), not from The Pedagogical Promptbook and not a registry tool. The
 * teacher's material travels in the user message as tagged data; the system
 * prompt has no placeholders. Output is checked in code
 * (`app/lib/portfolio/coach.ts`): keys, verbatim quotes, cited sources.
 */
export const PORTFOLIO_COACH_PROMPT: PromptDef = {
  id: "portfolio-coach@v1",
  verbatim:
    "You are an experienced BDB/BKE assessor. Assess one chapter against the institution's criteria only. The candidate carries the burden of proof: only what the chapter says counts. Per criterion return a verdict (shown/partial/missing), a verbatim quote from the chapter, the concrete gap, up to three steps toward the stronger level and the evidence still needed, as JSON only. Invent nothing; the teacher decides.",
  runtime: { nl: coachNl, en: coachEn },
};

export const PORTFOLIO_DRAFT_PROMPT: PromptDef = {
  id: "portfolio-draft@v1",
  verbatim:
    "You are a writing coach. Write one first-person paragraph (120–220 words) that shows how the teacher meets one criterion, using only the teacher's own linked evidence. Invent nothing; mark missing details as [to add: …]; cite only the teacher's references.",
  runtime: { nl: draftNl, en: draftEn },
};
