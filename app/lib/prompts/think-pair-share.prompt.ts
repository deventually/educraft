import type { PromptDef } from "./types";
import nl from "./files/think-pair-share.nl.md?raw";
import en from "./files/think-pair-share.en.md?raw";
import verbatim from "./book/think-pair-share.md?raw";

/**
 * SOURCE: Amara Atif, "Rethinking Think-Pair-Share: Generative AI as a Collaborative Peer in Technology Education", in The Pedagogical Promptbook (ed. D. Wiley), CC BY 4.0.
 * `verbatim` (book/think-pair-share.md) is the book's prompt, word for word: Appendix "Final Version of Prompts", part A "Core Prompt Structure", printed pp. 62–63.
 *
 * What LimeOnIt changed is in the tool's Attribution.adaptation. The runtime
 * variants (per language) live in files/think-pair-share.{nl,en}.md.
 */
export const THINK_PAIR_SHARE_PROMPT: PromptDef = {
  id: "think-pair-share@v1",
  verbatim,
  runtime: { nl, en },
};
