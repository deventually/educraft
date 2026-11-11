import { createHash } from "node:crypto";
import {
  streamText,
  generateText,
  type Instructions,
  type LanguageModel,
  type ModelMessage,
} from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { getProvider, outputTokenBudget, resolveModelInfo, type ConfigProvider } from "../models";
import type { GenerateOptions, LLMProvider } from "../types";
import { normalizeUsage } from "../usage";
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

/** The provider-specific options: the model's reasoning effort, and a cache key where wanted. */
function providerOptionsFor(provider: ConfigProvider, opts: GenerateOptions, effort?: string) {
  const own: Record<string, string> = {};
  if (effort) own[provider.api === "anthropic" ? "effort" : "reasoningEffort"] = effort;
  if (opts.cacheKey && typeof provider.cache === "object") {
    own[provider.cache.key] = opaqueKey(opts.cacheKey);
  }
  if (Object.keys(own).length === 0) return undefined;
  return { [provider.api === "anthropic" ? "anthropic" : provider.id]: own };
}

/** The key as the provider sees it: stable, but no user id leaves the server. */
function opaqueKey(cacheKey: string): string {
  return createHash("sha256").update(cacheKey).digest("hex").slice(0, 32);
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
  const providerOptions = provider ? providerOptionsFor(provider, opts, s.effort) : undefined;
  return {
    temperature,
    maxOutputTokens: outputTokenBudget(info, opts.maxTokens ?? s.maxTokens),
    ...(providerOptions ? { providerOptions } : {}),
  };
}

/** Claude's marker: keep the prompt up to and including this part (for five minutes). */
const KEEP = { anthropic: { cacheControl: { type: "ephemeral" as const } } };

/**
 * The prompt, marked for a provider that caches only what is marked (`cache: "markers"`)
 * when it comes back (`cacheKey`): the system prompt, and the turn before the last. The
 * last turn carries a reminder that is gone on the next turn, so a mark there is never read.
 */
function prompt(opts: GenerateOptions): { system: Instructions; messages: ModelMessage[] } {
  const messages = toMessages(opts);
  const provider = getProvider(resolveModelInfo(opts.model).provider);
  if (!opts.cacheKey || provider?.cache !== "markers") return { system: opts.system, messages };
  const before = messages.length - 2;
  return {
    system: { role: "system", content: opts.system, providerOptions: KEEP },
    messages: messages.map((m, i) => (i === before ? { ...m, providerOptions: KEEP } : m)),
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
      ...prompt(opts),
      ...settingsOptions(opts),
    });
    return {
      text,
      usage: normalizeUsage(usage),
      finishReason,
    };
  },

  async *streamChat(opts) {
    const result = streamText({
      model: resolveModel(opts.model),
      ...prompt(opts),
      ...settingsOptions(opts),
      abortSignal: opts.signal,
    });
    for await (const delta of result.textStream) {
      yield delta;
    }
    if (opts.onUsage) {
      const usage = normalizeUsage(await result.usage);
      if (usage) opts.onUsage(usage);
    }
  },
};
