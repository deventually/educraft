import { resolveModelInfo, type ProviderId } from "./models";
import type { LLMProvider } from "./types";
import { aiSdkProvider } from "./adapters/aisdk";
import { cliProvider } from "./adapters/cli";

/**
 * Registry mapping each provider id to its implementation.
 *
 * Anthropic, Ollama and LM Studio are all served by the single AI SDK adapter
 * (Ollama/LM Studio models are discovered at runtime). OpenAI / Google / Mistral
 * slot in by adding a catalog entry + key — same adapter, no new code. CLI agents
 * (claude code, opencode, codex, gemini cli) use the subprocess adapter.
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
  const provider = resolveModelInfo(modelId).provider;
  const impl = providers[provider];
  if (!impl) {
    throw new Error(`No provider configured for "${provider}" (model ${modelId}).`);
  }
  return impl;
}
