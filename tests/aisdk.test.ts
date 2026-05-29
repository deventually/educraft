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

import { aiSdkProvider } from "~/lib/ai/adapters/aisdk";

const base = {
  model: "ollama-llama3.1",
  system: "system",
  messages: [{ role: "user" as const, content: "hi" }],
};

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
});
