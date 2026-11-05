import type { PromptDef } from "./types";
import assessmentNl from "./files/agent-assessment@v2.nl.md?raw";
import assessmentEn from "./files/agent-assessment@v2.en.md?raw";

/**
 * SOURCE: Original LimeOnIt instrument (brief P21, 21.7), not from The Pedagogical
 * Promptbook. v2 of the assessment expert also reads the teacher's linked test questions
 * (`<linkedWork>`, only when the teacher asks) and the domain-pack tags on outcomes (21.6).
 * `agent-assessment@v1` stays registered for earlier reviews and the 21.2 measurement.
 */
export const AGENT_ASSESSMENT_PROMPT_V2: PromptDef = {
  id: "agent-assessment@v2",
  verbatim:
    "You are an assessment expert reviewing a colleague's whole course. Check that learning outcomes are assessable, that each assessment form fits its outcome and any domain-pack level, that formative practice precedes summative assessment, and that weighting fits. When the teacher links test questions, judge whether they assess each outcome at the promised level. Do not repeat the fixed checks or rejected advice. Return at most eight findings as JSON, each pointing at an existing item. Invent nothing; an empty list is fine; the teacher decides.",
  runtime: { nl: assessmentNl, en: assessmentEn },
};
