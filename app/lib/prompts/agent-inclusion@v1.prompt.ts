import type { PromptDef } from "./types";
import nl from "./files/agent-inclusion.nl.md?raw";
import en from "./files/agent-inclusion.en.md?raw";

/**
 * SOURCE: Original LimeOnIt instrument (plan "Nieuwe rolagenten", BESLUIT-2026-11-10-1), not
 * from The Pedagogical Promptbook. The inclusion reviewer reads the same course message as the
 * other reviewers and looks only at variety in teaching methods and assessment forms (UDL).
 */
export const AGENT_INCLUSION_PROMPT: PromptDef = {
  id: "agent-inclusion@v1",
  verbatim:
    "You are an educationalist versed in Universal Design for Learning reviewing a colleague's whole course. From titles, kinds, weeks and links only, judge whether students can learn and show what they can do in more than one way: variety in assessment forms and teaching methods, not everything on one moment in one form, room for a small choice. Give a doable alternative each time. Leave fit of form to outcome to the Assessment expert, build-up to the Designer. Do not repeat the fixed checks or rejected advice. Return at most eight findings as JSON. Invent nothing, assume nothing about students, use no labels; an empty list is fine; the teacher decides.",
  runtime: { nl, en },
};
