import { describe, expect, it } from "vitest";
import { normalizeUsage } from "~/lib/ai/usage";

// Seam: the one place that turns a provider's token report into our shape, so every
// provider (Anthropic, OpenAI-compatible, local) is counted the same way.
describe("normalizeUsage", () => {
  it("keeps the SDK's split into uncached, cache-read and cache-write input (Anthropic)", () => {
    const usage = normalizeUsage({
      inputTokens: 1_300,
      inputTokenDetails: { noCacheTokens: 100, cacheReadTokens: 1_000, cacheWriteTokens: 200 },
      outputTokens: 50,
      outputTokenDetails: { textTokens: 50, reasoningTokens: undefined },
    });
    expect(usage).toEqual({
      input: 100,
      cacheRead: 1_000,
      cacheWrite: 200,
      output: 50,
      reasoning: 0,
    });
  });

  it("derives the uncached part when a provider only reports a total and a cached share (OpenAI)", () => {
    const usage = normalizeUsage({
      inputTokens: 900,
      inputTokenDetails: {
        noCacheTokens: undefined,
        cacheReadTokens: 600,
        cacheWriteTokens: undefined,
      },
      outputTokens: 120,
      outputTokenDetails: { textTokens: 80, reasoningTokens: 40 },
    });
    expect(usage).toEqual({
      input: 300,
      cacheRead: 600,
      cacheWrite: 0,
      output: 120,
      reasoning: 40,
    });
  });

  it("counts everything as uncached input when a provider reports no cache at all", () => {
    expect(normalizeUsage({ inputTokens: 42, outputTokens: 7 })).toEqual({
      input: 42,
      cacheRead: 0,
      cacheWrite: 0,
      output: 7,
      reasoning: 0,
    });
  });

  it("returns undefined when the provider reports no tokens, so the call counts as unknown", () => {
    expect(normalizeUsage({ inputTokens: undefined, outputTokens: undefined })).toBeUndefined();
    expect(normalizeUsage(undefined)).toBeUndefined();
  });
});
