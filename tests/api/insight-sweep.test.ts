import { describe, it, expect, beforeAll, vi } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

type Chat = typeof import("~/server/repositories/chat.server");
type Insight = typeof import("~/server/repositories/insight.server");
type Sweep = typeof import("~/server/insight/sweep.server");

let chat: Chat;
let insight: Insight;
let sweep: Sweep;

beforeAll(async () => {
  chat = await import("~/server/repositories/chat.server");
  insight = await import("~/server/repositories/insight.server");
  sweep = await import("~/server/insight/sweep.server");
});

const VALID = JSON.stringify({
  topicsWorkedOn: ["recursion"],
  skillsProgressed: [],
  misconceptions: [],
  effort: "moderate",
});

function seed(
  sessionId: string,
  opts: { cohortId: string | null; count: number; at: Date; userId?: string },
) {
  const messages = Array.from({ length: opts.count }, (_, i) => ({
    role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
    content: `message ${i}`,
  }));
  return chat.recordChatTurn({
    sessionId,
    userId: opts.userId ?? "sweep-student",
    cohortId: opts.cohortId,
    toolSlug: "mentorai",
    model: "m",
    systemPrompt: "sys",
    messages,
    at: opts.at,
  });
}

const NOW = new Date("2026-07-05T12:00:00Z");
const THREE_HOURS_AGO = new Date(NOW.getTime() - 3 * 3_600_000);
const ONE_MINUTE_AGO = new Date(NOW.getTime() - 60_000);

describe("abandoned-session sweep", () => {
  it("summarises only eligible abandoned sessions, and never re-summarises", async () => {
    await seed("sw-eligible", { cohortId: "c1", count: 4, at: THREE_HOURS_AGO });
    await seed("sw-recent", { cohortId: "c1", count: 4, at: ONE_MINUTE_AGO });
    await seed("sw-short", { cohortId: "c1", count: 2, at: THREE_HOURS_AGO });
    await seed("sw-nocohort", { cohortId: null, count: 4, at: THREE_HOURS_AGO });
    await seed("sw-done", { cohortId: "c1", count: 4, at: THREE_HOURS_AGO });
    // sw-done was already closed by the student — a summary exists.
    await insight.saveSummary({
      sessionId: "sw-done",
      userId: "sweep-student",
      cohortId: "c1",
      toolSlug: "mentorai",
      summary: {
        topicsWorkedOn: ["pre-existing"],
        skillsProgressed: [],
        misconceptions: [],
        effort: "high",
      },
      helpfulness: 1,
    });

    const complete = vi.fn().mockResolvedValue(VALID);
    const result = await sweep.sweepAbandonedSessions({
      now: NOW,
      idleMs: 30 * 60_000, // idle ≥ 30 min
      minMessages: 4,
      complete,
      limit: 50,
    });

    // Only the one genuinely-abandoned, long-enough, un-summarised session ran.
    expect(complete).toHaveBeenCalledTimes(1);
    expect(result.summarised).toBe(1);

    const eligible = await insight.getSummary("sw-eligible");
    expect(eligible).not.toBeNull();
    // Abandoned (not explicitly closed) → no student self-report.
    expect(eligible?.helpfulness).toBeNull();
    expect(JSON.parse(eligible!.summaryJson).topicsWorkedOn).toEqual(["recursion"]);

    // Too-recent / too-short / no-cohort are all left alone.
    expect(await insight.getSummary("sw-recent")).toBeNull();
    expect(await insight.getSummary("sw-short")).toBeNull();
    expect(await insight.getSummary("sw-nocohort")).toBeNull();

    // The already-summarised session is untouched (not re-run, self-report kept).
    const done = await insight.getSummary("sw-done");
    expect(done?.helpfulness).toBe(1);
    expect(JSON.parse(done!.summaryJson).topicsWorkedOn).toEqual(["pre-existing"]);
  });

  it("marks a session processed even when the summariser fails, to bound cost", async () => {
    await seed("sw-poison", { cohortId: "c9", count: 4, at: THREE_HOURS_AGO });
    const complete = vi.fn().mockResolvedValue("not valid json"); // always fails

    const result = await sweep.sweepAbandonedSessions({
      now: NOW,
      idleMs: 30 * 60_000,
      minMessages: 4,
      complete,
    });

    // Retried once inside summariseSession, then gives up.
    expect(complete).toHaveBeenCalledTimes(2);
    expect(result.emptied).toBe(1);
    // An empty summary is recorded so the session is never re-swept.
    const saved = await insight.getSummary("sw-poison");
    expect(saved).not.toBeNull();
    expect(JSON.parse(saved!.summaryJson).topicsWorkedOn).toEqual([]);
    expect(saved?.helpfulness).toBeNull();
  });
});
