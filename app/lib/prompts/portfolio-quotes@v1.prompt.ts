import type { PromptDef } from "./types";
import nl from "./files/portfolio-quotes.nl.md?raw";
import en from "./files/portfolio-quotes.en.md?raw";

/**
 * SOURCE: Original LimeOnIt instrument for the BDB/BKE workplace (quotes from feedback per
 * criterion), not from The Pedagogical Promptbook and not a registry tool. The keyed framework
 * and one giver's feedback travel in the user message as tagged data; the system prompt has no
 * placeholders. Output is checked in code (`app/lib/portfolio/quotes.ts`): only known keys, and
 * only a quote that stands in the feedback word for word, stored in the feedback's own words.
 * Eval: `npm run eval:quotes`.
 */
export const PORTFOLIO_QUOTES_PROMPT: PromptDef = {
  id: "portfolio-quotes@v1",
  verbatim:
    "You help a teacher use other people's feedback as BDB/BKE evidence. Per criterion, propose at most three sentences from the feedback, copied word for word, that say concretely what was seen or done; leave out vague praise. Only keys from the framework. Only a proposal; no verdict. JSON only.",
  runtime: { nl, en },
};
