import type { PromptDef } from "./types";
import nl from "./files/forum-autograder.nl.md?raw";
import en from "./files/forum-autograder.en.md?raw";

/**
 * SOURCE: "AI-Supported Forum Autograder: A Community of Inquiry Approach"
 * The Pedagogical Promptbook (CC BY 4.0). Evaluated across Claude, ChatGPT, and Gemini.
 *
 * The runtime variants (one-shot adaptation, per language) live in
 * files/forum-autograder.{nl,en}.md.
 */
const verbatim = `You are an expert assessor of asynchronous forum discussions in higher education, using the Community of Inquiry (CoI) framework. Your task is to evaluate forum threads across three dimensions of presence: social (community building), cognitive (critical thinking), and teaching (instructor facilitation). Provide actionable scores and recommendations to help instructors strengthen their online teaching presence and guide deeper learning.`;

export const FORUM_AUTOGRADER_PROMPT: PromptDef = {
  id: "forum-autograder@v1",
  verbatim,
  runtime: { nl, en },
};
