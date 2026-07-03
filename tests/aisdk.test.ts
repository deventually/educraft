import { describe, it, expect, vi } from "vitest";

// Mock the AI SDK surface so the adapter is tested without any network/binary.
vi.mock("ai", () => ({
  streamText: vi.fn(() => ({
    textStream: (async function* () {
      yield "Hel";
      yield "lo";
    })(),
  })),
  generateText: vi.fn(async () => ({
    text: "Hello",
    usage: { inputTokens: 3, outputTokens: 5 },
  })),
}));
vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: () => ({ chatModel: () => ({ id: "mock-model" }) }),
}));
vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: () => () => ({ id: "mock-anthropic" }),
}));

import { streamText } from "ai";
import { aiSdkProvider } from "~/lib/ai/adapters/aisdk";

const base = {
  model: "ollama::llama3.1",
  system: "system",
  messages: [{ role: "user" as const, content: "hi" }],
};

/** Options of the most recent streamText() call the adapter made. */
function lastStreamOpts() {
  return vi.mocked(streamText).mock.calls.at(-1)?.[0];
}

describe("aiSdkProvider", () => {
  it("yields streamed text deltas", async () => {
    const out: string[] = [];
    for await (const delta of aiSdkProvider.streamChat(base)) out.push(delta);
    expect(out.join("")).toBe("Hello");
  });

  it("generates text and maps token usage to our shape", async () => {
    const result = await aiSdkProvider.generate(base);
    expect(result.text).toBe("Hello");
    expect(result.usage).toEqual({ input: 3, output: 5 });
  });

  it("passes an explicit maxTokens through to maxOutputTokens", async () => {
    for await (const _ of aiSdkProvider.streamChat({ ...base, maxTokens: 1234 })) void _;
    expect(lastStreamOpts()?.maxOutputTokens).toBe(1234);
  });

  it("falls back to the 8192 default when maxTokens is absent", async () => {
    for await (const _ of aiSdkProvider.streamChat(base)) void _;
    expect(lastStreamOpts()?.maxOutputTokens).toBe(8192);
  });
});
