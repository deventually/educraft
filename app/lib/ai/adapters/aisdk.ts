import { streamText, generateText, type LanguageModel, type ModelMessage } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { resolveModelInfo } from "../models";
import type { GenerateOptions, LLMProvider } from "../types";
import { env } from "~/server/env.server";
import { LocalizedError } from "~/lib/i18n/errors";

const DEFAULT_MAX_TOKENS = 8192;
const DEFAULT_TEMPERATURE = 0.4;

/** Resolve a catalog or dynamic local model id to a concrete AI SDK LanguageModel. */
function resolveModel(catalogId: string): LanguageModel {
  const info = resolveModelInfo(catalogId);
  switch (info.provider) {
    case "anthropic": {
      if (!env.ANTHROPIC_API_KEY) {
        throw new LocalizedError({
          nl: "ANTHROPIC_API_KEY ontbreekt. Vul deze in je .env in (zie .env.example).",
          en: "ANTHROPIC_API_KEY is missing. Add it to your .env (see .env.example).",
        });
      }
      return createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })(info.apiId);
    }
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
    case "openai-compat": {
      // A configured frontier / self-hosted OpenAI-compatible endpoint. The
      // model id ("compat::<apiId>") carries only the model; the endpoint lives
      // in .env. Key is optional (a self-hosted endpoint may need none).
      if (!env.OPENAI_COMPAT_BASE_URL) {
        throw new LocalizedError({
          nl: "OPENAI_COMPAT_BASE_URL ontbreekt. Vul de endpoint-URL in je .env in (zie .env.example).",
          en: "OPENAI_COMPAT_BASE_URL is missing. Add the endpoint URL to your .env (see .env.example).",
        });
      }
      return createOpenAICompatible({
        name: "openai-compat",
        baseURL: env.OPENAI_COMPAT_BASE_URL,
        apiKey: env.OPENAI_COMPAT_API_KEY,
      }).chatModel(info.apiId);
    }
    default:
      throw new Error(`Provider "${info.provider}" is not (yet) served via the AI SDK.`);
  }
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
    const { text, usage } = await generateText({
      model: resolveModel(opts.model),
      system: opts.system,
      messages: toMessages(opts),
      temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
      maxOutputTokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    });
    return {
      text,
      usage: { input: usage.inputTokens ?? 0, output: usage.outputTokens ?? 0 },
    };
  },

  async *streamChat(opts) {
    const result = streamText({
      model: resolveModel(opts.model),
      system: opts.system,
      messages: toMessages(opts),
      temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
      maxOutputTokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    });
    for await (const delta of result.textStream) {
      yield delta;
    }
  },
};
