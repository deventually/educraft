import { beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = "file::memory:";

let repo: typeof import("~/server/repositories/modelPrices.server");

beforeAll(async () => {
  repo = await import("~/server/repositories/modelPrices.server");
});

// Seam: the price list the meter and the admin screen read.
describe("modelPrices repository", () => {
  it("is empty on a fresh instance", async () => {
    expect(await repo.getModelPrices()).toEqual({});
  });

  it("sets, replaces and clears one model's price without touching the others", async () => {
    await repo.setModelPrice("claude-sonnet-5-5", { input: 3, output: 15 });
    await repo.setModelPrice("gpt-6.1-sol", { input: 1, output: 4, cacheRead: 0.1 });
    await repo.setModelPrice("claude-sonnet-5-5", { input: 2.5, output: 12 });
    expect(await repo.getModelPrices()).toEqual({
      "claude-sonnet-5-5": { input: 2.5, output: 12 },
      "gpt-6.1-sol": { input: 1, output: 4, cacheRead: 0.1 },
    });
    await repo.setModelPrice("gpt-6.1-sol", null);
    expect(Object.keys(await repo.getModelPrices())).toEqual(["claude-sonnet-5-5"]);
  });
});
