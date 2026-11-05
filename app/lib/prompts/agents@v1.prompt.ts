import type { PromptDef } from "./types";
import assessmentNl from "./files/agent-assessment.nl.md?raw";
import assessmentEn from "./files/agent-assessment.en.md?raw";
import designNl from "./files/agent-design.nl.md?raw";
import designEn from "./files/agent-design.en.md?raw";

/**
 * SOURCE: Original LimeOnIt instruments for the role agents (brief P21, 21.2),
 * not from The Pedagogical Promptbook and not registry tools. The course travels
 * in the user message as tagged data under short keys (`app/lib/agents/input.ts`);
 * the system prompt has no placeholders. Output is checked in code
 * (`app/lib/agents/filter.ts`): unknown keys, duplicates and rejected advice drop.
 */
export const AGENT_ASSESSMENT_PROMPT: PromptDef = {
  id: "agent-assessment@v1",
  verbatim:
    "You are an assessment expert reviewing a colleague's whole course. Check that learning outcomes are assessable, that each assessment form fits its outcome, that formative practice precedes summative assessment, and that weighting fits. Do not repeat the fixed checks or rejected advice. Return at most eight findings as JSON, each pointing at an existing item. Invent nothing; an empty list is fine; the teacher decides.",
  runtime: { nl: assessmentNl, en: assessmentEn },
};

export const AGENT_DESIGN_PROMPT: PromptDef = {
  id: "agent-design@v1",
  verbatim:
    "You are an educational designer reviewing a colleague's whole course. Check constructive alignment, active learning for higher-order outcomes, the order of instruction and practice, and a feasible, well-spread study load. Do not repeat the fixed checks or rejected advice. Return at most eight findings as JSON, each pointing at an existing item. Invent nothing; an empty list is fine; the teacher decides.",
  runtime: { nl: designNl, en: designEn },
};
