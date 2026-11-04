import { describe, it, expect, vi } from "vitest";

vi.mock("ai", () => ({
  streamText: vi.fn(() => ({ textStream: (async function* () {})() })),
  generateText: vi.fn(async () => ({
    text: "",
    usage: { inputTokens: 1, outputTokens: 6144 },
    finishReason: "length",
  })),
}));
vi.mock("@ai-sdk/anthropic", () => ({ createAnthropic: () => () => ({ id: "mock-anthropic" }) }));
vi.mock("~/server/env.server", () => ({ env: { ANTHROPIC_API_KEY: "test-key" } }));

import { generateText, streamText } from "ai";
import { aiSdkProvider } from "~/lib/ai/adapters/aisdk";
import { getModel, outputTokenBudget, THINKING_HEADROOM } from "~/lib/ai/models";

/**
 * Second measurement (2026-11-04): on Claude Sonnet 5.5 adaptive thinking counts
 * toward maxOutputTokens. Guided reflection (6144) spent all 6144 tokens thinking
 * and returned an empty answer; authentic assessment (12288) was cut off. A
 * tool's budget is meant for the answer, so models that always think get extra
 * room on top of it.
 */
describe("output budget for models that always think", () => {
  it("marks the current Claude 5.5 models as always thinking", () => {
    expect(getModel("claude-sonnet-5-5").alwaysThinks).toBe(true);
    expect(getModel("claude-opus-5-5").alwaysThinks).toBe(true);
    expect(getModel("claude-sonnet-4-6").alwaysThinks).not.toBe(true);
    expect(getModel("claude-haiku-4-5").alwaysThinks).not.toBe(true);
  });

  it("adds thinking room on top of the tool's answer budget", () => {
    expect(THINKING_HEADROOM).toBeGreaterThanOrEqual(16000);
    expect(outputTokenBudget(getModel("claude-sonnet-5-5"), 6144)).toBe(6144 + THINKING_HEADROOM);
  });

  it("leaves other models alone, and falls back to the 8192 default", () => {
    expect(outputTokenBudget(getModel("claude-sonnet-4-6"), 6144)).toBe(6144);
    expect(outputTokenBudget(getModel("claude-sonnet-4-6"), undefined)).toBe(8192);
    expect(outputTokenBudget(getModel("claude-sonnet-5-5"), undefined)).toBe(
      8192 + THINKING_HEADROOM,
    );
  });

  it("is what the adapter sends, streaming and not, and it reports why the model stopped", async () => {
    const opts = {
      model: "claude-sonnet-5-5",
      system: "s",
      messages: [{ role: "user" as const, content: "hi" }],
      maxTokens: 6144,
    };
    const r = await aiSdkProvider.generate(opts);
    expect(vi.mocked(generateText).mock.calls.at(-1)?.[0].maxOutputTokens).toBe(
      6144 + THINKING_HEADROOM,
    );
    expect(r.finishReason).toBe("length");
    for await (const _ of aiSdkProvider.streamChat(opts)) void _;
    expect(vi.mocked(streamText).mock.calls.at(-1)?.[0].maxOutputTokens).toBe(
      6144 + THINKING_HEADROOM,
    );
  });
});
