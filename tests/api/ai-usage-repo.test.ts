import { beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = "file::memory:";

type Repo = typeof import("~/server/repositories/aiUsage.server");
let repo: Repo;

beforeAll(async () => {
  repo = await import("~/server/repositories/aiUsage.server");
});

const tokens = (input: number, cacheRead: number, cacheWrite: number, output: number) => ({
  input,
  cacheRead,
  cacheWrite,
  output,
  reasoning: 0,
});

// Seam: the repository the dashboard reads — one row per user, day, source and model.
describe("aiUsage repository", () => {
  it("adds up calls and tokens per user, day, source and model", async () => {
    const u = "ai-usage-sum";
    const call = { source: "lesson-plan", model: "claude-sonnet-5-5" };
    await repo.recordAiUsage(u, { ...call, usage: tokens(100, 1_000, 0, 50) }, "2026-11-11");
    await repo.recordAiUsage(u, { ...call, usage: tokens(20, 0, 300, 10) }, "2026-11-11");

    expect(await repo.listAiUsage(u, "2026-11-01")).toEqual([
      {
        day: "2026-11-11",
        source: "lesson-plan",
        provider: "anthropic",
        model: "claude-sonnet-5-5",
        calls: 2,
        failedCalls: 0,
        unmeteredCalls: 0,
        inputTokens: 120,
        cacheReadTokens: 1_000,
        cacheWriteTokens: 300,
        outputTokens: 60,
        reasoningTokens: 0,
      },
    ]);
  });

  it("keeps a separate row per model and per source", async () => {
    const u = "ai-usage-split";
    const day = "2026-11-11";
    await repo.recordAiUsage(
      u,
      { source: "chat-tutor", model: "gpt-a", usage: tokens(1, 0, 0, 1) },
      day,
    );
    await repo.recordAiUsage(
      u,
      { source: "chat-tutor", model: "claude-b", usage: tokens(1, 0, 0, 1) },
      day,
    );
    await repo.recordAiUsage(
      u,
      { source: "portfolio-coach", model: "gpt-a", usage: tokens(1, 0, 0, 1) },
      day,
    );
    expect(await repo.listAiUsage(u, day)).toHaveLength(3);
  });

  it("counts a call without a token report, and a failed call, without inventing tokens", async () => {
    const u = "ai-usage-unknown";
    const call = { source: "lesson-plan", model: "cli-model" };
    await repo.recordAiUsage(u, call, "2026-11-11");
    await repo.recordAiUsage(u, { ...call, failed: true }, "2026-11-11");
    const [row] = await repo.listAiUsage(u, "2026-11-11");
    expect(row).toMatchObject({ calls: 2, failedCalls: 1, unmeteredCalls: 2, inputTokens: 0 });
  });

  it("only lists the asking user's rows, from the given day on", async () => {
    const call = { source: "lesson-plan", model: "gpt-a", usage: tokens(1, 0, 0, 1) };
    await repo.recordAiUsage("ai-usage-mine", call, "2026-10-01");
    await repo.recordAiUsage("ai-usage-mine", call, "2026-11-02");
    await repo.recordAiUsage("ai-usage-other", call, "2026-11-02");
    const rows = await repo.listAiUsage("ai-usage-mine", "2026-11-01");
    expect(rows.map((r) => r.day)).toEqual(["2026-11-02"]);
  });
});
