import type { PromptDef } from "./types";
import nl from "./files/arcs-reactor.nl.md?raw";
import en from "./files/arcs-reactor.en.md?raw";
import verbatim from "./book/arcs-reactor.md?raw";

/**
 * SOURCE: Travis N Thurston, "The ARCS Reactor: Powering Situated Intentional Motivational Design", in The Pedagogical Promptbook (ed. D. Wiley), CC BY 4.0.
 * `verbatim` (book/arcs-reactor.md) is the book's prompt, word for word: Appendix "Final Version of Prompt", printed pp. 185–186.
 *
 * What LimeOnIt changed is in the tool's Attribution.adaptation. The runtime
 * variants (per language) live in files/arcs-reactor.{nl,en}.md.
 */
export const ARCS_REACTOR_PROMPT: PromptDef = {
  id: "arcs-reactor@v1",
  verbatim,
  runtime: { nl, en },
};
