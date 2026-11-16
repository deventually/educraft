import { beforeAll, describe, expect, it } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let repo: typeof import("~/server/repositories/programmes.server");
let links: typeof import("~/server/repositories/programmeTeams.server");
let courses: typeof import("~/server/repositories/courses.server");
let users: typeof import("~/server/repositories/users.server");
let teams: typeof import("~/server/repositories/teams.server");
let shares: typeof import("~/server/repositories/shares.server");

beforeAll(async () => {
  repo = await import("~/server/repositories/programmes.server");
  links = await import("~/server/repositories/programmeTeams.server");
  courses = await import("~/server/repositories/courses.server");
  users = await import("~/server/repositories/users.server");
  teams = await import("~/server/repositories/teams.server");
  shares = await import("~/server/repositories/shares.server");
});

type Actor = { id: string; role: "teacher" | "admin" };
let n = 0;
const mk = async (who: string, role: "teacher" | "admin" = "teacher"): Promise<Actor> => {
  n += 1;
  const u = await users.createUser({ id: `${who}-${n}`, name: who, passwordHash: "x", role });
  return { id: u.id, role };
};
const hbo = (name: string) => ({ name, sector: "hbo", track: "bachelor" });

/**
 * The HSL example: the programme team of Informatica (lead + coordinator) and a module team
 * (lead + member). One programme, two teams.
 */
async function world() {
  const admin = await mk("Admin", "admin");
  const coordinator = await mk("Coordinator");
  const moduleLead = await mk("Moduleleider");
  const moduleMember = await mk("Modulelid");
  const outsider = await mk("Buiten");
  const programmeTeam = await teams.createTeam(`Opleidingsteam ${n}`);
  const moduleTeam = await teams.createTeam(`Moduleteam ${n}`);
  await teams.addMember(programmeTeam.id, coordinator.id);
  await teams.setLead(programmeTeam.id, coordinator.id, true);
  await teams.addMember(moduleTeam.id, moduleLead.id);
  await teams.setLead(moduleTeam.id, moduleLead.id, true);
  await teams.addMember(moduleTeam.id, moduleMember.id);
  const p = (await repo.createProgramme(coordinator, programmeTeam.id, hbo("Informatica VT")))!;
  return { admin, coordinator, moduleLead, moduleMember, outsider, programmeTeam, moduleTeam, p };
}

describe("a programme with several teams", () => {
  it("starts with the team it was made for", async () => {
    const { coordinator, programmeTeam, p } = await world();
    expect(p.teamIds).toEqual([programmeTeam.id]);
    expect(await repo.getProgramme(coordinator, p.id)).toMatchObject({
      teams: [{ id: programmeTeam.id, name: programmeTeam.name }],
    });
  });

  it("is linked to another team by an admin; that team reads it and its lead manages it", async () => {
    const { admin, moduleLead, moduleMember, programmeTeam, moduleTeam, p } = await world();
    expect(await repo.getProgramme(moduleMember, p.id)).toBeNull();
    expect(await links.linkProgrammeTeam(admin, p.id, moduleTeam.id)).toBe(true);
    const seen = await repo.getProgramme(moduleMember, p.id);
    expect(seen).toMatchObject({ canManage: false });
    expect(seen?.teams.map((t) => t.id).sort()).toEqual([programmeTeam.id, moduleTeam.id].sort());
    expect(await repo.getProgramme(moduleLead, p.id)).toMatchObject({ canManage: true });
    expect((await repo.listProgrammes(moduleMember)).map((x) => x.id)).toContain(p.id);
    // Linking twice changes nothing.
    expect(await links.linkProgrammeTeam(admin, p.id, moduleTeam.id)).toBe(true);
    expect((await repo.getProgramme(admin, p.id))?.teams).toHaveLength(2);
  });

  it("is linked to another team by a lead of one of its teams (BESLUIT-2026-11-16-3)", async () => {
    const { coordinator, moduleMember, moduleTeam, p } = await world();
    expect(await links.linkProgrammeTeam(coordinator, p.id, moduleTeam.id)).toBe(true);
    expect(await repo.getProgramme(moduleMember, p.id)).toMatchObject({ canManage: false });
  });

  it("refuses a plain member, an outsider, an unknown team and an unknown programme", async () => {
    const { admin, coordinator, moduleLead, moduleMember, outsider, moduleTeam, programmeTeam, p } =
      await world();
    // A lead of a team that is not (yet) the programme's has no say over it.
    expect(await links.linkProgrammeTeam(moduleLead, p.id, moduleTeam.id)).toBe(false);
    expect(await links.linkProgrammeTeam(outsider, p.id, moduleTeam.id)).toBe(false);
    await links.linkProgrammeTeam(admin, p.id, moduleTeam.id);
    const other = await teams.createTeam(`Ander team ${n}`);
    expect(await links.linkProgrammeTeam(moduleMember, p.id, other.id)).toBe(false);
    expect(await links.linkProgrammeTeam(coordinator, p.id, "nope")).toBe(false);
    expect(await links.linkProgrammeTeam(admin, "nope", programmeTeam.id)).toBe(false);
    expect((await repo.getProgramme(admin, p.id))?.teams).toHaveLength(2);
  });

  it("is unlinked from a team by an admin or a lead, but never from its last team", async () => {
    const { admin, coordinator, moduleMember, outsider, programmeTeam, moduleTeam, p } =
      await world();
    await links.linkProgrammeTeam(admin, p.id, moduleTeam.id);
    expect(await links.unlinkProgrammeTeam(moduleMember, p.id, moduleTeam.id)).toBe("refused");
    expect(await links.unlinkProgrammeTeam(outsider, p.id, moduleTeam.id)).toBe("refused");
    expect(await links.unlinkProgrammeTeam(coordinator, p.id, moduleTeam.id)).toBe("unlinked");
    expect(await repo.getProgramme(moduleMember, p.id)).toBeNull();
    await links.linkProgrammeTeam(admin, p.id, moduleTeam.id);
    expect(await links.unlinkProgrammeTeam(admin, p.id, moduleTeam.id)).toBe("unlinked");
    expect(await links.unlinkProgrammeTeam(admin, p.id, programmeTeam.id)).toBe("lastTeam");
    expect(await links.unlinkProgrammeTeam(coordinator, p.id, programmeTeam.id)).toBe("lastTeam");
    expect((await repo.getProgramme(admin, p.id))?.teamIds).toEqual([programmeTeam.id]);
  });

  it("lets a member of any of its teams place an own course, visible to every team", async () => {
    const { admin, coordinator, moduleMember, moduleTeam, p } = await world();
    await links.linkProgrammeTeam(admin, p.id, moduleTeam.id);
    const c = await courses.createCourse(moduleMember.id, { name: "Webtechnologie" });
    expect(await repo.placeCourse(moduleMember, p.id, c.id, { year: 1, period: 1 })).toBe(true);
    // Shared with the team the owner is in, and seen by the coordinator of the other team.
    expect(await shares.listItemShares(moduleMember.id, "course", c.id)).toEqual([moduleTeam.id]);
    expect((await repo.getProgramme(coordinator, p.id))?.courses.map((x) => x.name)).toEqual([
      "Webtechnologie",
    ]);
    expect((await repo.programmesOfCourse(c.id)).map((x) => x.name)).toEqual(["Informatica VT"]);
    expect((await repo.placeOptions(moduleMember.id)).map((x) => x.id)).toContain(p.id);
  });

  it("drops a course when its owner leaves the only team of the programme they were in", async () => {
    const { admin, coordinator, moduleMember, moduleTeam, p } = await world();
    await links.linkProgrammeTeam(admin, p.id, moduleTeam.id);
    const c = await courses.createCourse(moduleMember.id, { name: "Databases" });
    await repo.placeCourse(moduleMember, p.id, c.id, {});
    await teams.removeMember(moduleTeam.id, moduleMember.id);
    expect((await repo.getProgramme(coordinator, p.id))?.courses).toEqual([]);
  });

  it("stays when one of its teams is deleted; goes with its last team", async () => {
    const { admin, programmeTeam, moduleTeam, p } = await world();
    await links.linkProgrammeTeam(admin, p.id, moduleTeam.id);
    await teams.deleteTeam(programmeTeam.id);
    expect((await repo.getProgramme(admin, p.id))?.teamIds).toEqual([moduleTeam.id]);
    await teams.deleteTeam(moduleTeam.id);
    expect(await repo.getProgramme(admin, p.id)).toBeNull();
  });

  it("names every team in the list and on the course page", async () => {
    const { admin, moduleMember, programmeTeam, moduleTeam, p } = await world();
    await links.linkProgrammeTeam(admin, p.id, moduleTeam.id);
    const names = [programmeTeam.name, moduleTeam.name].sort().join(", ");
    expect((await repo.listProgrammes(admin)).find((x) => x.id === p.id)?.teamName).toBe(names);
    expect((await repo.placeOptions(moduleMember.id)).find((x) => x.id === p.id)?.teamName).toBe(
      names,
    );
  });

  it("says whether the reader is in one of its teams (only they place courses)", async () => {
    const { admin, coordinator, moduleMember, moduleTeam, p } = await world();
    expect(await repo.getProgramme(coordinator, p.id)).toMatchObject({ isMember: true });
    // An admin reads and manages every programme, but places a course only as a team member.
    expect(await repo.getProgramme(admin, p.id)).toMatchObject({
      isMember: false,
      canManage: true,
    });
    await links.linkProgrammeTeam(admin, p.id, moduleTeam.id);
    expect(await repo.getProgramme(moduleMember, p.id)).toMatchObject({ isMember: true });
  });
});
