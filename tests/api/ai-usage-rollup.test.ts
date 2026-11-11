import { beforeAll, describe, expect, it } from "vitest";

type Rollup = typeof import("~/server/repositories/aiUsageRollup.server");
type Usage = typeof import("~/server/repositories/aiUsage.server");
let rollup: Rollup;
let usage: Usage;
let teamA = "";
let teamB = "";

const tokens = { input: 100, cacheRead: 10, cacheWrite: 1, output: 50, reasoning: 0 };
// Far in the past, so rows from other files in the same database never count.
const old = "2001-03-15";
const keep = "2002-03-01";

beforeAll(async () => {
  rollup = await import("~/server/repositories/aiUsageRollup.server");
  usage = await import("~/server/repositories/aiUsage.server");
  const users = await import("~/server/repositories/users.server");
  const teams = await import("~/server/repositories/teams.server");
  for (const id of ["roll-a", "roll-b", "roll-c"]) {
    await users.createUser({ id, name: id, passwordHash: "scrypt:x:y", role: "teacher" });
  }
  teamA = (await teams.createTeam("Oprol A")).id;
  teamB = (await teams.createTeam("Oprol B")).id;
  await teams.addMember(teamA, "roll-a");
  await teams.addMember(teamA, "roll-b");
  await teams.addMember(teamB, "roll-b"); // in two teams
  // roll-c is in no team.
  const call = { source: "lesson-plan", model: "claude-sonnet-5-5", usage: tokens, costMicros: 7 };
  for (const id of ["roll-a", "roll-b", "roll-c"]) await usage.recordAiUsage(id, call, old);
  await usage.recordAiUsage("roll-a", call, "2001-03-20");
  await usage.recordAiUsage("roll-a", call, keep);
});

describe("retentionCutoff", () => {
  it("keeps the thirteen months the usage page offers: this month and the twelve before", () => {
    expect(rollup.retentionCutoff("2026-11-11")).toBe("2025-11-01");
    expect(rollup.retentionCutoff("2026-01-31")).toBe("2025-01-01");
  });
});

describe("rollUpAiUsage", () => {
  it("turns rows before the cutoff into month totals without a person, and deletes them", async () => {
    const moved = await rollup.rollUpAiUsage("2002-01-01");
    expect(moved).toBe(4);

    const rows = await rollup.listAiUsageRollup("2001-03");
    const whole = rows.find((r) => r.teamId === null);
    expect(whole).toMatchObject({ source: "lesson-plan", model: "claude-sonnet-5-5", calls: 4 });
    expect(whole?.inputTokens).toBe(400);
    expect(whole?.costMicros).toBe(28);
    // Per team: a person in two teams counts in both, as on the live page.
    expect(rows.find((r) => r.teamId === teamA)?.calls).toBe(3);
    expect(rows.find((r) => r.teamId === teamB)?.calls).toBe(1);
    expect(JSON.stringify(rows)).not.toContain("roll-");

    // The person rows are gone; the row after the cutoff stays.
    expect(await usage.listAiUsage("roll-a", "2000-01-01")).toEqual([
      expect.objectContaining({ day: keep, calls: 1 }),
    ]);
    expect(await usage.listAiUsage("roll-c", "2000-01-01")).toEqual([]);
  });

  it("adds to the month on a later run and does nothing when there is nothing old", async () => {
    await usage.recordAiUsage(
      "roll-c",
      { source: "lesson-plan", model: "claude-sonnet-5-5", usage: tokens, costMicros: 7 },
      old,
    );
    expect(await rollup.rollUpAiUsage("2002-01-01")).toBe(1);
    const whole = (await rollup.listAiUsageRollup("2001-03")).find((r) => r.teamId === null);
    expect(whole?.calls).toBe(5);
    expect(await rollup.rollUpAiUsage("2002-01-01")).toBe(0);
  });
});
