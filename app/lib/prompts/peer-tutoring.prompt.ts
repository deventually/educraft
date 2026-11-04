import type { PromptDef } from "./types";
import nl from "./files/peer-tutoring.nl.md?raw";
import en from "./files/peer-tutoring.en.md?raw";
import verbatim from "./book/peer-tutoring.md?raw";

/**
 * SOURCE: Rae Mair, Michelle Kelley, Taylar Wenzel, Andrea C. Burrows Borowczak, Yuqing Li & Mike Borowczak, "Generative AI Peer Tutoring to Support Peer-Reviewed Source Identification and Evaluation", in The Pedagogical Promptbook (ed. D. Wiley), CC BY 4.0.
 * `verbatim` (book/peer-tutoring.md) is the book's prompt, word for word: Appendix B "Draft 5: Final Version of Prompt", printed pp. 236–239 (the XML-like tags exactly as printed).
 *
 * What LimeOnIt changed is in the tool's Attribution.adaptation. The runtime
 * variants (per language) live in files/peer-tutoring.{nl,en}.md.
 */
export const PEER_TUTORING_PROMPT: PromptDef = {
  id: "peer-tutoring@v1",
  verbatim,
  runtime: { nl, en },
};
