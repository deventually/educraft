import { beforeAll, describe, expect, it } from "vitest";

type Reports = typeof import("~/server/repositories/aiUsageReports.server");
type Usage = typeof import("~/server/repositories/aiUsage.server");
let reports: Reports;
let usage: Usage;

// A month of its own, so rows from other files in the same database never count.
const month = { from: "2031-03-01", until: "2031-03-31" };
const trend = { from: "2031-02-03", until: "2031-03-31" };

const tokens = (input: number, cacheRead: number, output: number) => ({
  input,
  cacheRead,
  cacheWrite: 0,
  output,
  reasoning: 0,
});

let teamId = "";
let smallTeamId = "";

beforeAll(async () => {
  reports = await import("~/server/repositories/aiUsageReports.server");
  usage = await import("~/server/repositories/aiUsage.server");
  const users = await import("~/server/repositories/users.server");
  const teams = await import("~/server/repositories/teams.server");
  for (const id of ["rep-lead", "rep-a", "rep-b", "rep-c", "rep-out"]) {
    await users.createUser({ id, name: `Naam ${id}`, passwordHash: "scrypt:x:y", role: "teacher" });
  }
  const team = await teams.createTeam("Rapport team");
  teamId = team.id;
  for (const id of ["rep-lead", "rep-a", "rep-b"]) await teams.addMember(teamId, id);
  await teams.setLead(teamId, "rep-lead", true);
  const small = await teams.createTeam("Klein team");
  smallTeamId = small.id;
  for (const id of ["rep-lead", "rep-c"]) await teams.addMember(smallTeamId, id);
  await teams.setLead(smallTeamId, "rep-lead", true);

  const call = (source: string, model: string, input = 100) => ({
    source,
    model,
    usage: tokens(input, 0, 10),
    costMicros: 1_000,
  });
  await usage.recordAiUsage("rep-lead", call("lesson-plan", "claude-sonnet-5-5"), "2031-03-02");
  await usage.recordAiUsage("rep-a", call("lesson-plan", "claude-sonnet-5-5"), "2031-03-03");
  await usage.recordAiUsage("rep-b", call("chat-tutor", "gpt-6-astra", 50), "2031-03-10");
  await usage.recordAiUsage("rep-c", call("chat-tutor", "gpt-6-astra"), "2031-03-10");
  await usage.recordAiUsage("rep-out", call("lesson-plan", "claude-sonnet-5-5"), "2031-03-11");
  // Before the month: only in the trend.
  await usage.recordAiUsage("rep-a", call("lesson-plan", "claude-sonnet-5-5"), "2031-02-20");
  // After the month: nowhere.
  await usage.recordAiUsage("rep-a", call("lesson-plan", "claude-sonnet-5-5"), "2031-04-01");
});

describe("ownAiUsage", () => {
  it("adds up only the user's own month, per source and model, with days for the trend", async () => {
    const r = await reports.ownAiUsage("rep-a", month, trend);
    expect(r.total.calls).toBe(1);
    expect(r.total.inputTokens).toBe(100);
    expect(r.sources).toEqual([expect.objectContaining({ key: "lesson-plan", calls: 1 })]);
    expect(r.models).toEqual([
      expect.objectContaining({ key: "claude-sonnet-5-5", label: "anthropic", calls: 1 }),
    ]);
    expect(r.days.map((d) => [d.key, d.calls])).toEqual([
      ["2031-02-20", 1],
      ["2031-03-03", 1],
    ]);
  });
});

describe("teamAiUsage", () => {
  it("adds up the team's members, never names them", async () => {
    const r = await reports.teamAiUsage("rep-lead", teamId, month, trend);
    expect(r?.activeMembers).toBe(3);
    expect(r?.total.calls).toBe(3);
    expect(r?.sources.map((s) => [s.key, s.calls])).toEqual([
      ["chat-tutor", 1],
      ["lesson-plan", 2],
    ]);
    expect(JSON.stringify(r)).not.toContain("rep-a");
  });

  it("is null for a member who does not lead the team", async () => {
    expect(await reports.teamAiUsage("rep-a", teamId, month, trend)).toBeNull();
    expect(await reports.teamAiUsage("rep-out", teamId, month, trend)).toBeNull();
  });

  it("shows only totals when fewer than three members were active", async () => {
    const r = await reports.teamAiUsage("rep-lead", smallTeamId, month, trend);
    expect(r?.activeMembers).toBe(2);
    expect(r?.total.calls).toBe(2);
    expect(r?.sources).toEqual([]);
    expect(r?.models).toEqual([]);
  });
});

describe("instanceAiUsage", () => {
  it("adds up everyone, per person, team, model and provider", async () => {
    const r = await reports.instanceAiUsage(month, trend);
    expect(r.total.calls).toBe(5);
    expect(r.total.costMicros).toBe(5_000);
    expect(r.users.find((u) => u.key === "rep-b")).toMatchObject({
      label: "Naam rep-b",
      calls: 1,
      inputTokens: 50,
    });
    expect(r.teams.map((t) => [t.label, t.calls])).toEqual([
      ["Klein team", 2],
      ["Rapport team", 3],
    ]);
    expect(r.providers.map((p) => [p.key, p.calls])).toEqual([
      ["anthropic", 3],
      ["openai", 2],
    ]);
  });
});
