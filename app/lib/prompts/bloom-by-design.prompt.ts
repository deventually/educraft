import type { PromptDef } from "./types";
import nl from "./files/bloom-by-design.nl.md?raw";
import en from "./files/bloom-by-design.en.md?raw";
import verbatim from "./book/bloom-by-design.md?raw";

/**
 * SOURCE: Adam Palczewski, Laura Decuzzi & Dempsey Cruz, "Bloom by Design: Prompt Engineering an AI Chatbot for Constructive Alignment of Outcomes and EdTech", in The Pedagogical Promptbook (ed. D. Wiley), CC BY 4.0.
 * `verbatim` (book/bloom-by-design.md) is the book's prompt, word for word: Appendix "Final Version of Prompt", printed pp. 206–207.
 *
 * What LimeOnIt changed is in the tool's Attribution.adaptation. The runtime
 * variants (per language) live in files/bloom-by-design.{nl,en}.md.
 */
export const BLOOM_BY_DESIGN_PROMPT: PromptDef = {
  id: "bloom-by-design@v1",
  verbatim,
  runtime: { nl, en },
};
