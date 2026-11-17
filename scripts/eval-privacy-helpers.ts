/**
 * The anonymiseerpoort in an eval (`--privacy-gate`, BESLUIT-2026-11-17-5): the generation goes
 * through the same pure gate as the app, replacing every known name, and the answer gets the names
 * back before the judge reads it. So a run with and a run without the flag differ only in the gate.
 * The judge's own calls never go through it.
 */
import type { LLMProvider } from "~/lib/ai/types";
import { gatePrompt, type KnownPeople, restoreStream } from "~/lib/privacy/gate";
import { restoreNames } from "~/lib/privacy/redact";

/** The fictional circle for a case without its own `privacyKnown`. */
export const EVAL_CIRCLE: KnownPeople = {
  teacher: "Mark de Groot",
  colleagues: ["Mirjam de Boer", "Fatima el Amrani", "Pieter Bakker"],
};

export function privacyGated(
  provider: LLMProvider,
  known: KnownPeople,
  locale: "nl" | "en",
): LLMProvider {
  const gate = (opts: Parameters<LLMProvider["generate"]>[0]) => {
    const g = gatePrompt(opts, { known, mode: "replace" }, locale);
    if (!g.send) throw new Error("unreachable: replace mode always sends");
    return { opts: { ...opts, system: g.system, messages: g.messages }, codes: g.codes };
  };
  return {
    id: `${provider.id}+privacy-gate`,
    async generate(opts) {
      const { opts: gated, codes } = gate(opts);
      const result = await provider.generate(gated);
      return { ...result, text: restoreNames(result.text, codes) };
    },
    streamChat(opts) {
      const { opts: gated, codes } = gate(opts);
      return restoreStream(provider.streamChat(gated), codes);
    },
  };
}
