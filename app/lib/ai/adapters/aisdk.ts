import { streamText, generateText, type LanguageModel, type ModelMessage } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { getProvider, outputTokenBudget, resolveModelInfo, type ConfigProvider } from "../models";
import type { GenerateOptions, LLMProvider } from "../types";
import { env, providerSetting } from "~/server/env.server";
import { LocalizedError } from "~/lib/i18n/errors";

const DEFAULT_TEMPERATURE = 0.4;

function missing(name: string): LocalizedError {
  return new LocalizedError({
    nl: `${name} ontbreekt. Vul deze in je .env in (zie .env.example).`,
    en: `${name} is missing. Add it to your .env (see .env.example).`,
  });
}

/** A provider's key from the server environment, or a message naming the setting. */
function requireKey(provider: ConfigProvider): string | undefined {
  const value = providerSetting(provider.keyEnv);
  if (!value && !provider.keyOptional) throw missing(provider.keyEnv);
  return value;
}

/** Resolve a catalog or dynamic local model id to a concrete AI SDK LanguageModel. */
function resolveModel(catalogId: string): LanguageModel {
  const info = resolveModelInfo(catalogId);
  switch (info.provider) {
    case "ollama":
      return createOpenAICompatible({ name: "ollama", baseURL: env.OLLAMA_BASE_URL }).chatModel(
        info.apiId,
      );
    case "lmstudio":
      return createOpenAICompatible({
        name: "lmstudio",
        baseURL: env.LMSTUDIO_BASE_URL,
        apiKey: "lm-studio",
      }).chatModel(info.apiId);
  }
  // An API provider from `config/models.json`: Anthropic's own API, or the OpenAI
  // chat API at a known address (or one from a server setting, for an own endpoint).
  const provider = getProvider(info.provider);
  if (!provider) {
    throw new Error(`Provider "${info.provider}" is not (yet) served via the AI SDK.`);
  }
  // A server setting may override the address (a proxy, a region, an own endpoint).
  const baseURL =
    (provider.baseURLEnv ? providerSetting(provider.baseURLEnv) : undefined) ?? provider.baseURL;
  if (provider.api === "anthropic") {
    return createAnthropic({ apiKey: requireKey(provider), baseURL })(info.apiId);
  }
  if (!baseURL) throw missing(provider.baseURLEnv ?? provider.id);
  return createOpenAICompatible({
    name: provider.id,
    baseURL,
    apiKey: requireKey(provider),
  }).chatModel(info.apiId);
}

/**
 * The model's settings as AI SDK call options: temperature (`null` = none sent, which
 * wins over the caller), and its reasoning effort in the form its API expects.
 */
function settingsOptions(opts: GenerateOptions) {
  const info = resolveModelInfo(opts.model);
  const s = info.settings ?? {};
  const temperature =
    s.temperature === null ? undefined : (opts.temperature ?? s.temperature ?? DEFAULT_TEMPERATURE);
  const provider = getProvider(info.provider);
  const effort = s.effort;
  const providerOptions =
    effort && provider
      ? provider.api === "anthropic"
        ? { anthropic: { effort } }
        : { [provider.id]: { reasoningEffort: effort } }
      : undefined;
  return {
    temperature,
    maxOutputTokens: outputTokenBudget(info, opts.maxTokens ?? s.maxTokens),
    ...(providerOptions ? { providerOptions } : {}),
  };
}

/** Build AI SDK messages, attaching images to the LAST user message if present. */
function toMessages(opts: GenerateOptions): ModelMessage[] {
  return opts.messages.map((m, i): ModelMessage => {
    const isLastUser = m.role === "user" && i === opts.messages.length - 1 && !!opts.images?.length;
    if (isLastUser) {
      return {
        role: "user",
        content: [
          { type: "text", text: m.content },
          ...(opts.images ?? []).map((img) => ({
            type: "image" as const,
            image: img.dataBase64,
            mediaType: img.mediaType,
          })),
        ],
      };
    }
    return { role: m.role, content: m.content };
  });
}

/**
 * One adapter that serves every HTTP / OpenAI-compatible provider through the
 * Vercel AI SDK: Anthropic (API), Ollama and LM Studio (local), and any frontier
 * API added to the catalog later. The concrete provider is chosen per-model from
 * the catalog, so call sites only ever see the portable LLMProvider interface.
 * CLI agents (claude code, opencode, codex, gemini cli) get their own adapters.
 */
export const aiSdkProvider: LLMProvider = {
  id: "ai-sdk",

  async generate(opts) {
    const { text, usage, finishReason } = await generateText({
      model: resolveModel(opts.model),
      system: opts.system,
      messages: toMessages(opts),
      ...settingsOptions(opts),
    });
    return {
      text,
      usage: { input: usage.inputTokens ?? 0, output: usage.outputTokens ?? 0 },
      finishReason,
    };
  },

  async *streamChat(opts) {
    const result = streamText({
      model: resolveModel(opts.model),
      system: opts.system,
      messages: toMessages(opts),
      ...settingsOptions(opts),
    });
    for await (const delta of result.textStream) {
      yield delta;
    }
  },
};
