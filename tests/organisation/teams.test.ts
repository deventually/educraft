import { beforeAll, describe, expect, it } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let org: typeof import("~/server/repositories/organisation.server");
let programmes: typeof import("~/server/repositories/programmes.server");
let users: typeof import("~/server/repositories/users.server");
let teams: typeof import("~/server/repositories/teams.server");

beforeAll(async () => {
  org = await import("~/server/repositories/organisation.server");
  programmes = await import("~/server/repositories/programmes.server");
  users = await import("~/server/repositories/users.server");
  teams = await import("~/server/repositories/teams.server");
});

let n = 0;
async function mk(role: "teacher" | "admin") {
  n += 1;
  const u = await users.createUser({
    id: `ot-${role}-${n}`,
    name: `P ${n}`,
    passwordHash: "x",
    role,
  });
  return { id: u.id, role };
}

describe("a team under a division", () => {
  it("is put under a division by an admin, and taken out again", async () => {
    const admin = await mk("admin");
    const d = (await org.createDivision(admin, "Faculteit Zorg"))!;
    const team = await teams.createTeam("Onderwijscommissie Zorg");
    expect(await org.setTeamDivision(admin, team.id, d.id)).toBe(true);
    expect((await org.listDivisions()).find((x) => x.id === d.id)).toMatchObject({
      teams: [{ id: team.id, name: "Onderwijscommissie Zorg" }],
    });
    expect(await org.setTeamDivision(admin, team.id, null)).toBe(true);
    expect((await org.listDivisions()).find((x) => x.id === d.id)?.teams).toEqual([]);
  });

  it("refuses a teacher, an unknown division and an unknown team", async () => {
    const admin = await mk("admin");
    const teacher = await mk("teacher");
    const d = (await org.createDivision(admin, "Vestiging Noord"))!;
    const team = await teams.createTeam("Sectie Nederlands");
    expect(await org.setTeamDivision(teacher, team.id, d.id)).toBe(false);
    expect(await org.setTeamDivision(admin, team.id, "nope")).toBe(false);
    expect(await org.setTeamDivision(admin, "nope", d.id)).toBe(false);
  });

  it("keeps a division with a team under it", async () => {
    const admin = await mk("admin");
    const d = (await org.createDivision(admin, "Met team"))!;
    const team = await teams.createTeam("Team onder onderdeel");
    await org.setTeamDivision(admin, team.id, d.id);
    expect(await org.deleteDivision(admin, d.id)).toBe("notEmpty");
  });
});

describe("where a team sits: its programmes and its division", () => {
  it("names the programmes of the team and the division (the team's own, else its programmes')", async () => {
    const admin = await mk("admin");
    const d = (await org.createDivision(admin, "Faculteit Gezondheid"))!;
    const team = await teams.createTeam("Team VPK");
    const vt = await programmes.createProgramme(admin, team.id, {
      name: "VPK voltijd",
      sector: "hbo",
    });
    await programmes.createProgramme(admin, team.id, { name: "VPK deeltijd", sector: "hbo" });
    await org.setProgrammeDivision(admin, vt!.id, d.id);
    const lone = await teams.createTeam("Werkgroep AI");
    const places = await org.teamPlaces();
    expect(places.get(team.id)).toEqual({
      programmes: ["VPK deeltijd", "VPK voltijd"],
      division: "Faculteit Gezondheid",
    });
    expect(places.get(lone.id)).toBeUndefined();
  });
});
