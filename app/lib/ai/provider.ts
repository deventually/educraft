import { resolveModelInfo, type ProviderId } from "./models";
import type { LLMProvider } from "./types";
import { aiSdkProvider } from "./adapters/aisdk";
import { ollamaProvider } from "./adapters/ollama";
import { cliProvider } from "./adapters/cli";

/**
 * Registry mapping each provider id to its implementation.
 *
 * Anthropic and LM Studio are served by the AI SDK adapter. Ollama uses its own
 * native adapter (`/api/chat`) so the reasoning ("thinking") switch works — the
 * AI SDK's `/v1` path ignores it. OpenAI / Google / Mistral slot in by adding a
 * catalog entry + key — same AI SDK adapter, no new code. CLI agents (claude
 * code, opencode, codex, gemini cli) use the subprocess adapter.
 */
const providers: Partial<Record<ProviderId, LLMProvider>> = {
  anthropic: aiSdkProvider,
  ollama: ollamaProvider,
  lmstudio: aiSdkProvider,
  // Any configured OpenAI-compatible endpoint (frontier or self-hosted).
  "openai-compat": aiSdkProvider,
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
