import { describe, it, expect, beforeEach, vi } from "vitest";

// env.server needs a DATABASE_URL before import; OLLAMA_BASE_URL keeps its default
// (http://localhost:11434/v1), which the adapter strips to hit the native API.
process.env.DATABASE_URL = "file::memory:";

import { ollamaProvider } from "~/lib/ai/adapters/ollama";
import type { GenerateOptions } from "~/lib/ai/types";

/** A stub Response whose body streams the given NDJSON lines. */
function ndjsonResponse(lines: string[], ok = true, status = 200): Response {
  return new Response(ok ? `${lines.join("\n")}\n` : "boom", { status });
}

const base: GenerateOptions = {
  model: "ollama::qwen3.6:35b-a3b-coding-nvfp4",
  system: "You are a tutor.",
  messages: [{ role: "user", content: "hi" }],
};

let fetchMock: ReturnType<typeof vi.fn>;

/** The parsed body of the most recent fetch the adapter made. */
function lastBody(): Record<string, unknown> {
  const init = fetchMock.mock.calls.at(-1)?.[1] as RequestInit;
  return JSON.parse(init.body as string);
}
function lastUrl(): string {
  return String(fetchMock.mock.calls.at(-1)?.[0]);
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

describe("ollamaProvider — native /api/chat adapter", () => {
  it("streams only content deltas, dropping the thinking field and empty deltas", async () => {
    fetchMock.mockResolvedValue(
      ndjsonResponse([
        `{"message":{"role":"assistant","thinking":"let me reason..."}}`,
        `{"message":{"role":"assistant","content":"Hel"}}`,
        `{"message":{"role":"assistant","content":"lo"}}`,
        `{"message":{"role":"assistant","content":""},"done":true,"prompt_eval_count":10,"eval_count":2}`,
      ]),
    );
    const out: string[] = [];
    for await (const d of ollamaProvider.streamChat(base)) out.push(d);
    expect(out.join("")).toBe("Hello");
  });

  it("hits the native /api/chat endpoint (the /v1 suffix is stripped)", async () => {
    fetchMock.mockResolvedValue(ndjsonResponse([`{"message":{"content":"x"},"done":true}`]));
    for await (const _ of ollamaProvider.streamChat(base)) void _;
    expect(lastUrl()).toBe("http://localhost:11434/api/chat");
  });

  it("sends the raw apiId, a system message, and think:false when thinking is off", async () => {
    fetchMock.mockResolvedValue(ndjsonResponse([`{"message":{"content":"x"},"done":true}`]));
    for await (const _ of ollamaProvider.streamChat({ ...base, thinking: false })) void _;
    const body = lastBody();
    expect(body.model).toBe("qwen3.6:35b-a3b-coding-nvfp4"); // apiId, not the ollama:: id
    expect(body.think).toBe(false);
    expect(body.stream).toBe(true);
    expect(body.messages).toEqual([
      { role: "system", content: "You are a tutor." },
      { role: "user", content: "hi" },
    ]);
  });

  it("sends think:true when thinking is on, and omits think entirely when unset", async () => {
    // A fresh Response per call — a body can only be read once.
    fetchMock.mockImplementation(() =>
      Promise.resolve(ndjsonResponse([`{"message":{"content":"x"},"done":true}`])),
    );
    for await (const _ of ollamaProvider.streamChat({ ...base, thinking: true })) void _;
    expect(lastBody().think).toBe(true);

    for await (const _ of ollamaProvider.streamChat(base)) void _;
    expect("think" in lastBody()).toBe(false); // undefined → let the model decide
  });

  it("passes temperature + maxTokens through Ollama's options block", async () => {
    fetchMock.mockResolvedValue(ndjsonResponse([`{"message":{"content":"x"},"done":true}`]));
    for await (const _ of ollamaProvider.streamChat({
      ...base,
      temperature: 0.2,
      maxTokens: 1234,
    })) {
      void _;
    }
    expect(lastBody().options).toEqual({ temperature: 0.2, num_predict: 1234 });
  });

  it("attaches images as raw base64 on the last user message", async () => {
    fetchMock.mockResolvedValue(ndjsonResponse([`{"message":{"content":"x"},"done":true}`]));
    for await (const _ of ollamaProvider.streamChat({
      ...base,
      images: [{ mediaType: "image/png", dataBase64: "AAAA" }],
    })) {
      void _;
    }
    const msgs = lastBody().messages as Array<{ role: string; images?: string[] }>;
    expect(msgs.at(-1)?.images).toEqual(["AAAA"]);
  });

  it("generate returns the message content and maps usage counts", async () => {
    fetchMock.mockResolvedValue(
      ndjsonResponse([
        `{"message":{"role":"assistant","content":"Hello"},"done":true,"prompt_eval_count":3,"eval_count":5}`,
      ]),
    );
    const res = await ollamaProvider.generate(base);
    expect(res.text).toBe("Hello");
    expect(res.usage).toEqual({ input: 3, output: 5 });
  });

  it("throws a localized error when Ollama is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(async () => {
      for await (const _ of ollamaProvider.streamChat(base)) void _;
    }).rejects.toThrow();
  });
});
