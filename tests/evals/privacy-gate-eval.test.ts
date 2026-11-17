import { describe, expect, it } from "vitest";
import type { GenerateOptions, LLMProvider } from "~/lib/ai/types";
import { EVAL_CIRCLE, privacyGated } from "../../scripts/eval-privacy-helpers";

/** `--privacy-gate`: the eval's generation leaves through the same gate as the app. */
describe("privacyGated", () => {
  const seen: GenerateOptions[] = [];
  const fake: LLMProvider = {
    id: "fake",
    async generate(opts) {
      seen.push(opts);
      return { text: "Bespreek het met [COLLEGA-1] en [DOCENT]." };
    },
    async *streamChat(opts) {
      seen.push(opts);
      yield "Vraag [COLL";
      yield "EGA-1].";
    },
  };
  const opts = {
    model: "m",
    system: "Beoordeel.",
    messages: [{ role: "user" as const, content: "Ik besprak het met Mirjam en Mark de Groot." }],
  };

  it("sends codes and gives the judge the names back", async () => {
    const r = await privacyGated(fake, EVAL_CIRCLE, "nl").generate(opts);
    expect(seen.at(-1)?.messages[0]?.content).toBe("Ik besprak het met [COLLEGA-1] en [DOCENT].");
    expect(r.text).toBe("Bespreek het met Mirjam en Mark de Groot.");
  });

  it("restores a streamed chat turn too", async () => {
    let out = "";
    for await (const c of privacyGated(fake, EVAL_CIRCLE, "nl").streamChat(opts)) out += c;
    expect(out).toBe("Vraag Mirjam.");
  });
});
