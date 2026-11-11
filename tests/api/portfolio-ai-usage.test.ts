import { beforeAll, describe, expect, it, vi } from "vitest";
import { effectivePrice } from "~/lib/ai/models";

process.env.DATABASE_URL = "file::memory:";

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("~/lib/ai/provider", () => ({ providerForModel: () => ({ id: "fake", generate }) }));

let ai: typeof import("~/server/portfolioAi.server");
let aiUsage: typeof import("~/server/repositories/aiUsage.server");
let usage: typeof import("~/server/repositories/usage.server");
let prices: typeof import("~/server/repositories/modelPrices.server");

beforeAll(async () => {
  ai = await import("~/server/portfolioAi.server");
  aiUsage = await import("~/server/repositories/aiUsage.server");
  usage = await import("~/server/repositories/usage.server");
  prices = await import("~/server/repositories/modelPrices.server");
});

const teacher = (id: string) => ({ id, name: "T", email: null, role: "teacher" }) as never;
const tokens = { input: 900, cacheRead: 0, cacheWrite: 0, output: 120, reasoning: 0 };

// Seam: the one structured model call outside the tool stream, as the dashboard reads it.
describe("callPortfolioModel measures its AI use", () => {
  it("records the call per source and model, with its tokens, and feeds the quota", async () => {
    generate.mockResolvedValueOnce({ text: "ok", usage: tokens });
    const r = await ai.callPortfolioModel(
      teacher("pai-ok"),
      "portfolio-coach@v1",
      "msg",
      "nl",
      100,
      "portfolio-coach",
      "claude-sonnet-5-5",
    );
    expect(r?.text).toBe("ok");
    const [row] = await aiUsage.listAiUsage("pai-ok", usage.utcDay());
    expect(row).toMatchObject({
      source: "portfolio-coach",
      provider: "anthropic",
      model: "claude-sonnet-5-5",
      calls: 1,
      inputTokens: 900,
      outputTokens: 120,
    });
    expect((await usage.getTodayUsage("pai-ok")).outputTokens).toBe(120);
  });

  it("records a failed call too, without tokens", async () => {
    generate.mockRejectedValueOnce(new Error("overloaded"));
    await ai.callPortfolioModel(
      teacher("pai-fail"),
      "portfolio-coach@v1",
      "msg",
      "nl",
      100,
      "portfolio-coach",
      "claude-sonnet-5-5",
    );
    const [row] = await aiUsage.listAiUsage("pai-fail", usage.utcDay());
    expect(row).toMatchObject({ calls: 1, failedCalls: 1, unmeteredCalls: 1 });
  });
});

describe("callPortfolioModel prices its AI use", () => {
  const call = (id: string, model: string) =>
    ai.callPortfolioModel(
      teacher(id),
      "portfolio-coach@v1",
      "msg",
      "nl",
      100,
      "portfolio-coach",
      model,
    );

  it("prices the call with the admin's price of that moment, which beats the list price", async () => {
    await prices.setModelPrice("claude-sonnet-5-5", { input: 3, output: 15 });
    generate.mockResolvedValueOnce({ text: "ok", usage: tokens });
    await call("pai-priced", "claude-sonnet-5-5");
    await prices.setModelPrice("claude-sonnet-5-5", { input: 300, output: 1500 });
    const [row] = await aiUsage.listAiUsage("pai-priced", usage.utcDay());
    // 900 × €3 + 120 × €15 per million = €0.0045
    expect(row).toMatchObject({ costMicros: 4_500, unpricedCalls: 0 });
    await prices.setModelPrice("claude-sonnet-5-5", null);
  });

  it("prices the call at the catalog's list price in euros when the admin set none", async () => {
    generate.mockResolvedValueOnce({ text: "ok", usage: tokens });
    await call("pai-list", "claude-haiku-4-5");
    const [row] = await aiUsage.listAiUsage("pai-list", usage.utcDay());
    const { price } = effectivePrice("claude-haiku-4-5", {})!;
    const expected = Math.round(900 * price.input + 120 * price.output);
    expect(row).toMatchObject({ costMicros: expected, unpricedCalls: 0 });
    expect(expected).toBeGreaterThan(0);
  });

  it("counts a model without a price (a router has no fixed one) as unpriced", async () => {
    generate.mockResolvedValueOnce({ text: "ok", usage: tokens });
    await call("pai-unpriced", "openrouter-auto");
    const [row] = await aiUsage.listAiUsage("pai-unpriced", usage.utcDay());
    expect(row).toMatchObject({ costMicros: 0, unpricedCalls: 1 });
  });

  it("prices a local model at zero, without the admin setting a price", async () => {
    generate.mockResolvedValueOnce({ text: "ok", usage: tokens });
    await call("pai-local", "ollama::llama3.1");
    const [row] = await aiUsage.listAiUsage("pai-local", usage.utcDay());
    expect(row).toMatchObject({ provider: "ollama", costMicros: 0, unpricedCalls: 0 });
  });
});
