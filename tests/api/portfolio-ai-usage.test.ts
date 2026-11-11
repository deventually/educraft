import { beforeAll, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL = "file::memory:";

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("~/lib/ai/provider", () => ({ providerForModel: () => ({ id: "fake", generate }) }));

let ai: typeof import("~/server/portfolioAi.server");
let aiUsage: typeof import("~/server/repositories/aiUsage.server");
let usage: typeof import("~/server/repositories/usage.server");

beforeAll(async () => {
  ai = await import("~/server/portfolioAi.server");
  aiUsage = await import("~/server/repositories/aiUsage.server");
  usage = await import("~/server/repositories/usage.server");
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
