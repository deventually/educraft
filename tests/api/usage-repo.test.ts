import { describe, it, expect, beforeAll } from "vitest";

// Isolated in-memory DB + a small daily limit, both set before any server module
// (and thus env.server) is imported.
process.env.DATABASE_URL = "file::memory:";
process.env.DAILY_REQUEST_LIMIT = "2";

type Repo = typeof import("~/server/repositories/usage.server");
let repo: Repo;

beforeAll(async () => {
  repo = await import("~/server/repositories/usage.server");
});

describe("usage repository", () => {
  it("accumulates requests and output chars per user+day (upsert)", async () => {
    const u = "usage-user-accum";
    await repo.recordUsage(u, { chars: 100 }, "2026-07-01");
    await repo.recordUsage(u, { chars: 50 }, "2026-07-01");

    const usage = await repo.getTodayUsage(u, "2026-07-01");
    expect(usage.requests).toBe(2);
    expect(usage.outputChars).toBe(150);
  });

  it("keeps a separate counter per day and reports zero for an untouched day", async () => {
    const u = "usage-user-days";
    await repo.recordUsage(u, { chars: 10 }, "2026-07-01");
    expect((await repo.getTodayUsage(u, "2026-07-01")).requests).toBe(1);
    expect((await repo.getTodayUsage(u, "2026-07-02")).requests).toBe(0);
  });

  it("checkQuota flips from ok to not-ok once requests reach the limit", async () => {
    const u = "usage-user-limit";
    const day = "2026-07-05";
    expect((await repo.checkQuota(u, day)).ok).toBe(true);
    await repo.recordUsage(u, { chars: 1 }, day);
    expect((await repo.checkQuota(u, day)).ok).toBe(true);
    await repo.recordUsage(u, { chars: 1 }, day);
    // Limit is 2 → the 3rd request is refused.
    expect((await repo.checkQuota(u, day)).ok).toBe(false);
  });

  it("resets the quota on day rollover", async () => {
    const u = "usage-user-rollover";
    await repo.recordUsage(u, { chars: 1 }, "2026-07-10");
    await repo.recordUsage(u, { chars: 1 }, "2026-07-10");
    expect((await repo.checkQuota(u, "2026-07-10")).ok).toBe(false);
    expect((await repo.checkQuota(u, "2026-07-11")).ok).toBe(true);
  });

  it("accumulates optional token counts when provided", async () => {
    const u = "usage-user-tokens";
    await repo.recordUsage(u, { chars: 5, tokens: 100 }, "2026-07-20");
    await repo.recordUsage(u, { chars: 5, tokens: 250 }, "2026-07-20");
    expect((await repo.getTodayUsage(u, "2026-07-20")).outputTokens).toBe(350);
  });
});
