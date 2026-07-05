import type { PromptDef } from "./types";
import nl from "./files/session-summary.nl.md?raw";
import en from "./files/session-summary.en.md?raw";

/**
 * SOURCE: Original LimeOnIt instrument (not from The Pedagogical Promptbook).
 * The post-session summariser (Phase 7): it turns one finished tutoring
 * transcript into a de-personalised, structured learning signal for the
 * provisioning mentor — engagement/topics/misconceptions about the *material*,
 * never verbatim quotes or personal disclosure. Its output is validated + leak-
 * checked in `app/lib/insight/summary.ts` before it can reach a mentor.
 *
 * The runtime variants (per language) live in files/session-summary.{nl,en}.md.
 */
const verbatim = `You summarise one finished tutoring conversation into a de-personalised learning signal for a mentor. Reply with exactly one JSON object: { topicsWorkedOn[], skillsProgressed[], misconceptions[] (about the material), effort }. Never quote the transcript. Never include the student's feelings, confidence, or personal circumstances. Misconceptions are about the material, not the person. This is advice for a mentor who decides — never an automated verdict.`;

export const SESSION_SUMMARY_PROMPT: PromptDef = {
  id: "session-summary@v1",
  verbatim,
  runtime: { nl, en },
};
