import { beforeAll, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL = "file::memory:";

vi.mock("~/server/auth.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/server/auth.server")>();
  return { ...actual, requireRole: vi.fn(async () => ({ id: "admin", role: "admin" })) };
});

let route: typeof import("~/routes/admin.usage");
let teamId = "";

beforeAll(async () => {
  route = await import("~/routes/admin.usage");
  const users = await import("~/server/repositories/users.server");
  const teams = await import("~/server/repositories/teams.server");
  const generations = await import("~/server/repositories/generations.server");
  for (const id of ["hsl-1", "hhs-1"]) {
    await users.createUser({ id, name: id, passwordHash: "scrypt:x:y", role: "teacher" });
    await generations.saveGeneration({
      userId: id,
      toolSlug: "mentorai",
      model: "m",
      input: {},
      outputLanguage: "nl",
      outputMarkdown: "x",
    });
  }
  const team = await teams.createTeam("HSL");
  await teams.addMember(team.id, "hsl-1");
  teamId = team.id;
});

const load = (q = "") =>
  route.loader({ request: new Request(`http://localhost/admin/usage${q}`) } as never);

describe("admin usage loader: pilot per tool", () => {
  it("counts everyone without a team filter, and lists the teams", async () => {
    const data = await load();
    expect(data.teamId).toBe("");
    expect(data.teams.map((t) => t.name)).toEqual(["HSL"]);
    expect(data.pilot.find((r) => r.toolSlug === "mentorai")?.uses).toBe(2);
  });

  it("counts only the team's members with ?team=", async () => {
    const data = await load(`?team=${teamId}`);
    expect(data.teamId).toBe(teamId);
    expect(data.pilot.find((r) => r.toolSlug === "mentorai")?.uses).toBe(1);
  });

  it("ignores an unknown team", async () => {
    const data = await load("?team=nope");
    expect(data.teamId).toBe("");
    expect(data.pilot.find((r) => r.toolSlug === "mentorai")?.uses).toBe(2);
  });
});
