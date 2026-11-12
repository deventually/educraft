import type { PromptDef } from "./types";
import en from "./files/conversation-prep.en.md?raw";
import nl from "./files/conversation-prep.nl.md?raw";

/**
 * SOURCE: Original LimeOnIt tool (brief P39, 39.2), not from The Pedagogical Promptbook.
 * No conversation model is claimed: the set uses general conversation technique.
 */
const verbatim = `Original LimeOnIt tool, not from The Pedagogical Promptbook. You are an experienced study career coach who helps a colleague prepare one kind of conversation with a student (a start, progress, a threatening negative binding study advice, dropping out, choosing a minor or internship), for the propaedeutic or main phase. You write opening questions, follow-up questions, what not to ask, how to close and make agreements, and when to refer on. The set is about the situation, never a particular student; it gives no advice on the study advice decision and names no counter that the institution has not listed.`;

export const CONVERSATION_PREP_PROMPT: PromptDef = {
  id: "conversation-prep@v1",
  verbatim,
  runtime: { nl, en },
};
