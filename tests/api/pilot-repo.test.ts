import { beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = "file::memory:";

type Pilot = typeof import("~/server/repositories/pilot.server");
type Feedback = typeof import("~/server/repositories/feedback.server");
type Generations = typeof import("~/server/repositories/generations.server");
type Teams = typeof import("~/server/repositories/teams.server");
type Users = typeof import("~/server/repositories/users.server");

let pilot: Pilot;
let feedback: Feedback;
let generations: Generations;
let teams: Teams;
let users: Users;

beforeAll(async () => {
  pilot = await import("~/server/repositories/pilot.server");
  feedback = await import("~/server/repositories/feedback.server");
  generations = await import("~/server/repositories/generations.server");
  teams = await import("~/server/repositories/teams.server");
  users = await import("~/server/repositories/users.server");
});

async function seedUser(id: string) {
  await users.createUser({ id, name: `User ${id}`, passwordHash: "scrypt:x:y", role: "teacher" });
}

async function gen(userId: string, toolSlug = "mentorai") {
  return (
    await generations.saveGeneration({
      userId,
      toolSlug,
      model: "m",
      input: {},
      outputLanguage: "nl",
      outputMarkdown: "out",
    })
  ).id;
}

describe("pilot check-in", () => {
  it("is due after a few results, and not again for a while after an answer", async () => {
    await seedUser("ci-a");
    expect(await pilot.isCheckinDue("ci-a")).toBe(false);
    await gen("ci-a");
    await gen("ci-a");
    await gen("ci-a");
    expect(await pilot.isCheckinDue("ci-a")).toBe(true);

    await pilot.saveCheckin("ci-a", { helped: "Snel", annoyed: "", missing: "Spraak" });
    expect(await pilot.isCheckinDue("ci-a")).toBe(false);
  });

  it("a dismissal also counts, and stores no answers", async () => {
    await seedUser("ci-b");
    for (let i = 0; i < 3; i++) await gen("ci-b");
    await pilot.dismissCheckin("ci-b");
    expect(await pilot.isCheckinDue("ci-b")).toBe(false);
    const mine = (await pilot.listCheckins()).filter((c) => c.userId === "ci-b");
    expect(mine).toHaveLength(0);
  });

  it("lists answers with the teacher's name, newest first", async () => {
    const rows = (await pilot.listCheckins()).filter((c) => c.userId === "ci-a");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userName: "User ci-a", helped: "Snel", missing: "Spraak" });
    expect(rows[0]!.annoyed).toBeNull();
  });

  it("deleteCheckinsForUser removes everything of that user only", async () => {
    await pilot.deleteCheckinsForUser("ci-a");
    expect((await pilot.listCheckins()).some((c) => c.userId === "ci-a")).toBe(false);
  });
});

describe("pilot overview per tool, filtered by team", () => {
  it("counts uses and feedback of team members only", async () => {
    await seedUser("ov-hsl");
    await seedUser("ov-hhs");
    const team = await teams.createTeam("HSL");
    await teams.addMember(team.id, "ov-hsl");

    const g1 = await gen("ov-hsl", "bloom-by-design");
    await gen("ov-hsl", "bloom-by-design");
    const g3 = await gen("ov-hhs", "bloom-by-design");
    await feedback.upsertFeedback({
      userId: "ov-hsl",
      generationId: g1,
      rating: 1,
      minutesSaved: 30,
      quality: 4,
    });
    await feedback.upsertFeedback({ userId: "ov-hhs", generationId: g3, rating: -1 });

    const hsl = await pilot.pilotOverview({ teamId: team.id });
    const row = hsl.find((r) => r.toolSlug === "bloom-by-design");
    expect(row).toMatchObject({ uses: 2, up: 1, down: 0, minutesSaved: 30, qualityAvg: 4 });

    const all = await pilot.pilotOverview({});
    const allRow = all.find((r) => r.toolSlug === "bloom-by-design");
    expect(allRow).toMatchObject({ uses: 3, up: 1, down: 1 });
  });

  it("filters the check-ins and the feedback list by team too", async () => {
    const team = (await teams.listTeams()).find((t) => t.name === "HSL")!;
    await pilot.saveCheckin("ov-hsl", { helped: "Ja", annoyed: "", missing: "" });
    await pilot.saveCheckin("ov-hhs", { helped: "Nee", annoyed: "", missing: "" });
    const ids = (await pilot.listCheckins({ teamId: team.id })).map((c) => c.userId);
    expect(ids).toEqual(["ov-hsl"]);

    const fb = await feedback.listFeedbackWithContext({ teamId: team.id });
    expect(fb.map((f) => f.userId)).toEqual(["ov-hsl"]);
    expect(fb[0]).toMatchObject({ minutesSaved: 30, quality: 4 });
  });
});
