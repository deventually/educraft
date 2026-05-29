import { getModel, type ProviderId } from "./models";
import type { LLMProvider } from "./types";
import { aiSdkProvider } from "./adapters/aisdk";
import { cliProvider } from "./adapters/cli";

/**
 * Registry mapping each provider id to its implementation.
 *
 * Anthropic, Ollama and LM Studio are all served today by the single AI SDK
 * adapter. OpenAI / Google / Mistral slot in by adding a catalog entry + key —
 * same adapter, no new code. CLI agents (claude code, opencode, codex, gemini
 * cli) will get their own subprocess adapters and register here too.
 */
const providers: Partial<Record<ProviderId, LLMProvider>> = {
  anthropic: aiSdkProvider,
  ollama: aiSdkProvider,
  lmstudio: aiSdkProvider,
  "claude-code": cliProvider,
  opencode: cliProvider,
  codex: cliProvider,
  "gemini-cli": cliProvider,
};

export function providerForModel(modelId: string): LLMProvider {
  const provider = getModel(modelId).provider;
  const impl = providers[provider];
  if (!impl) {
    throw new Error(`Geen provider geconfigureerd voor "${provider}" (model ${modelId}).`);
  }
  return impl;
}
