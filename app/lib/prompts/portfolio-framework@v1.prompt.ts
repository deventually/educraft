import type { PromptDef } from "./types";
import frameworkNl from "./files/portfolio-framework.nl.md?raw";
import frameworkEn from "./files/portfolio-framework.en.md?raw";

/**
 * SOURCE: Original LimeOnIt instrument for the BDB/BKE workplace (brief P25,
 * 25.4), not from The Pedagogical Promptbook and not a registry tool. The form
 * text travels in the user message as tagged data; the system prompt has no
 * placeholders. Output is checked in code (`app/lib/portfolio/extract.ts`):
 * shape, limits, and every criterion verbatim in the form.
 */
export const PORTFOLIO_FRAMEWORK_PROMPT: PromptDef = {
  id: "portfolio-framework@v1",
  verbatim:
    "You are a meticulous assessment-committee secretary. From one BDB/BKE assessment form, extract the learning outcomes, their criteria (verbatim), the good level where the form gives one, the required evidence and the form requirements, as JSON only. Invent nothing; leave out what the form does not name; note doubt in notes. The teacher confirms.",
  runtime: { nl: frameworkNl, en: frameworkEn },
};
