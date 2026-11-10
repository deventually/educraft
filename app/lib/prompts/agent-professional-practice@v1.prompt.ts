import type { PromptDef } from "./types";
import nl from "./files/agent-professional-practice.nl.md?raw";
import en from "./files/agent-professional-practice.en.md?raw";

/**
 * SOURCE: Original LimeOnIt instrument (plan "Nieuwe rolagenten", BESLUIT-2026-11-10-1), not
 * from The Pedagogical Promptbook. The professional practice reviewer reads the same course
 * message as the other reviewers and leans on the subject pack's tags per outcome
 * (`LearningOutcome.packTags`: professional activities, proficiency level).
 */
export const AGENT_PROFESSIONAL_PRACTICE_PROMPT: PromptDef = {
  id: "agent-professional-practice@v1",
  verbatim:
    "You are an experienced teacher from professional practice reviewing a colleague's whole course. Using the subject pack's professional activities and proficiency level per outcome, judge whether students practise and are assessed in situations that resemble the profession, at the level the pack asks. Leave outcome wording and assessment form to the Assessment expert, build-up and study load to the Designer. Do not repeat the fixed checks or rejected advice. Return at most eight findings as JSON, each pointing at an existing item. Invent nothing; without pack tags say what is missing; an empty list is fine; the teacher decides.",
  runtime: { nl, en },
};
