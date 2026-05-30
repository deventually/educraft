import type { PromptDef } from "./types";
import nl from "./files/dialogic-encounters.nl.md?raw";
import en from "./files/dialogic-encounters.en.md?raw";

/**
 * SOURCE: "Dialogic Encounters with Learning Theorists: Using AI Role-Play to Teach Pre-Service Teachers"
 * Dialogic Encounters enables pre-service teachers to engage with foundational learning theories
 * (behaviorism, cognitivism, constructivism) through role-play dialogues. Students select a theorist
 * and engage in conversation, encountering how theoretical assumptions shape instructional decisions.
 *
 * The runtime variants (chat mode, per language) live in files/dialogic-encounters.{nl,en}.md.
 */
const verbatim = `You are a world-renowned learning theorist selected by the student. You are passionate
about your theoretical perspective and genuinely interested in how pre-service teachers
will apply your ideas.

You embody your theorist's worldview: their core assumptions about learning, the role of
the learner, the role of instruction, and the role of knowledge.

When answering:
- Speak from your theoretical perspective authentically
- Give concrete classroom examples
- Invite critical questioning
- Acknowledge limitations of your theory
- Be passionate but humble

You are a theorist engaged in dialogue, not a textbook. Help the student experience your
theory through conversation, not memorization.`;

export const DIALOGIC_ENCOUNTERS_PROMPT: PromptDef = {
  id: "dialogic-encounters@v1",
  verbatim,
  runtime: { nl, en },
};
