import { resolveModelInfo } from "../models";
import type { GenerateOptions, LLMProvider } from "../types";
import { env } from "~/server/env.server";
import { LocalizedError } from "~/lib/i18n/errors";

const DEFAULT_MAX_TOKENS = 8192;
const DEFAULT_TEMPERATURE = 0.4;

/**
 * Native Ollama adapter (`/api/chat`). The AI SDK's OpenAI-compatible provider
 * talks to Ollama's `/v1` endpoint, which does NOT honor the `think` parameter —
 * so reasoning ("thinking") models always reason before answering, adding many
 * seconds of latency to every chat turn. This adapter uses Ollama's native API,
 * where `think:false` yields a direct answer. Reasoning tokens (the `thinking`
 * field) are dropped from the stream, so the visible answer is never polluted by
 * raw chain-of-thought. Ollama-only; LM Studio stays on the AI SDK adapter.
 */

/** Strip the OpenAI-compat `/v1` suffix to reach Ollama's native root. */
function nativeChatUrl(): string {
  return `${env.OLLAMA_BASE_URL.replace(/\/v1\/?$/, "")}/api/chat`;
}

/** Ollama message shape: images ride as raw base64 on the LAST user turn. */
function toOllamaMessages(opts: GenerateOptions): Array<Record<string, unknown>> {
  const system = opts.system ? [{ role: "system", content: opts.system }] : [];
  const turns = opts.messages.map((m, i) => {
    const isLastUser = m.role === "user" && i === opts.messages.length - 1 && !!opts.images?.length;
    return isLastUser
      ? {
          role: m.role,
          content: m.content,
          images: (opts.images ?? []).map((img) => img.dataBase64),
        }
      : { role: m.role, content: m.content };
  });
  return [...system, ...turns];
}

function buildBody(opts: GenerateOptions, stream: boolean): Record<string, unknown> {
  const info = resolveModelInfo(opts.model);
  const body: Record<string, unknown> = {
    model: info.apiId,
    messages: toOllamaMessages(opts),
    stream,
    options: {
      temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
      num_predict: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    },
  };
  // Only send `think` when the caller expressed a preference; omitting it lets the
  // model use its own default (and avoids sending it to non-thinking models).
  if (typeof opts.thinking === "boolean") body.think = opts.thinking;
  return body;
}

const unreachable = new LocalizedError({
  nl: "Kan geen verbinding maken met Ollama. Draait de server (OLLAMA_BASE_URL)?",
  en: "Could not reach Ollama. Is the server running (OLLAMA_BASE_URL)?",
});

async function post(opts: GenerateOptions, stream: boolean): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(nativeChatUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildBody(opts, stream)),
    });
  } catch {
    throw unreachable;
  }
  if (!res.ok) {
    throw new LocalizedError({
      nl: `Ollama gaf een fout terug (${res.status}).`,
      en: `Ollama returned an error (${res.status}).`,
    });
  }
  return res;
}

/** The `content` of one streamed NDJSON line, or "" for thinking/keepalive lines. */
function contentOf(line: string): string {
  const obj = JSON.parse(line) as { message?: { content?: string } };
  return obj.message?.content ?? "";
}

export const ollamaProvider: LLMProvider = {
  id: "ollama-native",

  async generate(opts) {
    const res = await post(opts, false);
    const data = (await res.json()) as {
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };
    return {
      text: data.message?.content ?? "",
      usage: { input: data.prompt_eval_count ?? 0, output: data.eval_count ?? 0 },
    };
  },

  async *streamChat(opts) {
    const res = await post(opts, true);
    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // keep the trailing partial line for the next chunk
      for (const line of lines) {
        const delta = line.trim() ? contentOf(line.trim()) : "";
        if (delta) yield delta;
      }
    }
    const tail = buffer.trim();
    if (tail) {
      const delta = contentOf(tail);
      if (delta) yield delta;
    }
  },
};
