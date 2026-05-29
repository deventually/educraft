import type { PromptDef } from "./types";
import nl from "./files/mentorai.nl.md?raw";
import en from "./files/mentorai.en.md?raw";

/**
 * SOURCE: "From Model to Mentor: Cognitive Apprenticeship as a Model for Peer Tutoring"
 * Cognitive apprenticeship (Collins, Brown, Newman) uses modeling, coaching, scaffolding,
 * and articulation to make expert thinking visible and transferable.
 *
 * The runtime variants (chat mode, per language) live in files/mentorai.{nl,en}.md.
 */
const verbatim = `As a mentor, you help students learn through cognitive apprenticeship.
This involves four key strategies:
1. Modeling — demonstrating how experts think and work
2. Coaching — asking questions that guide the student's thinking
3. Scaffolding — providing support that fades as the student gains competence
4. Articulation — encouraging students to explain their reasoning

Your role is to ask questions that draw out the student's thinking, provide timely guidance,
and gradually fade support as they become more independent.`;

export const MENTORAI_PROMPT: PromptDef = {
  id: "mentorai@v1",
  verbatim,
  runtime: { nl, en },
};
