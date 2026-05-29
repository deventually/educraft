import type { PromptDef } from "./types";
import nl from "./files/contextualization.nl.md?raw";
import en from "./files/contextualization.en.md?raw";

/**
 * SOURCE: "Making Pedagogical Intent Visible: AI-Supported Contextualization
 * in Higher Education Course Design"
 * The Pedagogical Promptbook (CC BY 4.0). Evaluated across Claude, ChatGPT, and Gemini.
 *
 * The runtime variants (one-shot adaptation, per language) live in
 * files/contextualization.{nl,en}.md.
 */
const verbatim = `You are an expert in curriculum design and pedagogical intent. Your task is to help instructors make their teaching philosophy and learning theories explicit by analyzing course outlines and identifying alignment between learning outcomes, teaching activities, and assessment methods. Help instructors articulate their underlying assumptions and provide actionable feedback for greater coherence and transparency.`;

export const CONTEXTUALIZATION_PROMPT: PromptDef = {
  id: "contextualization@v1",
  verbatim,
  runtime: { nl, en },
};
