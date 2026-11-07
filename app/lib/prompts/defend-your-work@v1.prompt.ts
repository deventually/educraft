import type { PromptDef } from "./types";
import en from "./files/defend-your-work.en.md?raw";
import nl from "./files/defend-your-work.nl.md?raw";
import verbatim from "./book/defend-your-work.md?raw";

/**
 * SOURCE: Andy Van Schaack & Roman Sarlo, "From Oracle to Socratic Partner: Redesigning
 * Instruction with AI Through the Science of Learning", in The Pedagogical Promptbook
 * (ed. D. Wiley), CC BY 4.0. `verbatim` (book/defend-your-work.md) is the book's prompt, word
 * for word: Appendix F.3, the Student System Prompt of Worked Example 2 "Lab Oral Defense",
 * printed pp. 350–352.
 *
 * Brief P31, 31.1. What LimeOnIt changed is in the tool's Attribution.adaptation: the chemistry
 * lab becomes any own work (report, internship, project, professional product), Dr. McQuain
 * an unnamed expert from the field, the fixed 15 minutes the teacher's duration.
 */
export const DEFEND_YOUR_WORK_PROMPT: PromptDef = {
  id: "defend-your-work@v1",
  verbatim,
  runtime: { nl, en },
};
