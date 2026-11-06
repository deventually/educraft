import { getProvider, resolveModelInfo, type ProviderId } from "./models";
import type { LLMProvider } from "./types";
import { aiSdkProvider } from "./adapters/aisdk";
import { ollamaProvider } from "./adapters/ollama";
import { cliProvider } from "./adapters/cli";

/**
 * Which adapter serves a model. Every API provider in `config/models.json` (Anthropic,
 * OpenAI, Google, Mistral, MiniMax, OpenRouter, OpenCode Zen, an own endpoint, …) goes
 * through the AI SDK adapter. Ollama has its own native adapter (`/api/chat`) so the
 * reasoning ("thinking") switch works; LM Studio uses the AI SDK; CLI agents (Claude
 * Code, opencode, Codex, Gemini CLI) use the subprocess adapter.
 */
const local: Partial<Record<ProviderId, LLMProvider>> = {
  ollama: ollamaProvider,
  lmstudio: aiSdkProvider,
  "claude-code": cliProvider,
  opencode: cliProvider,
  codex: cliProvider,
  "gemini-cli": cliProvider,
};

export function providerForModel(modelId: string): LLMProvider {
  const provider = resolveModelInfo(modelId).provider;
  const impl = local[provider] ?? (getProvider(provider) ? aiSdkProvider : undefined);
  if (!impl) {
    throw new Error(`No provider configured for "${provider}" (model ${modelId}).`);
  }
  return impl;
}
