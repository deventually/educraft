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

describe("a programme made by the admin (BESLUIT-2026-11-16-4)", () => {
  it("starts without a team, under a faculty, and only the admin sees it", async () => {
    const { admin, coordinator } = await world();
    const org = await import("~/server/repositories/organisation.server");
    const d = (await org.createDivision(admin, `Faculteit ${n}`))!;
    const p = (await repo.createProgramme(admin, null, hbo("HBO-ICT"), d.id))!;
    expect(p).toMatchObject({ teamIds: [], divisionId: d.id });
    expect(await repo.getProgramme(coordinator, p.id)).toBeNull();
    expect((await repo.listProgrammes(admin)).map((x) => x.id)).toContain(p.id);
  });

  it("refuses a teacher without a team, and an unknown faculty", async () => {
    const { admin, coordinator, programmeTeam } = await world();
    expect(await repo.createProgramme(coordinator, null, hbo("Mag niet"))).toBeNull();
    expect(await repo.createProgramme(admin, null, hbo("Mag niet"), "nope")).toBeNull();
    // A lead puts it under no faculty; that is the admin's choice.
    const p = (await repo.createProgramme(coordinator, programmeTeam.id, hbo("Mag wel"), "x"))!;
    expect(p).toMatchObject({ divisionId: null });
  });
});

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

  it("is linked by a team lead to their own team, and taken off again (BESLUIT-2026-11-16-4)", async () => {
    const { moduleLead, moduleMember, moduleTeam, p } = await world();
    expect(await links.linkProgrammeTeam(moduleLead, p.id, moduleTeam.id)).toBe(true);
    expect(await repo.getProgramme(moduleMember, p.id)).toMatchObject({ canManage: false });
    expect(await repo.getProgramme(moduleLead, p.id)).toMatchObject({ canManage: true });
    expect(await links.unlinkProgrammeTeam(moduleLead, p.id, moduleTeam.id)).toBe("unlinked");
    expect(await repo.getProgramme(moduleMember, p.id)).toBeNull();
  });

  it("refuses a lead who links another team, a plain member, an outsider, unknown ids", async () => {
    const { admin, coordinator, moduleMember, outsider, moduleTeam, programmeTeam, p } =
      await world();
    // Leading the programme's team is no say over another team.
    expect(await links.linkProgrammeTeam(coordinator, p.id, moduleTeam.id)).toBe(false);
    expect(await links.linkProgrammeTeam(moduleMember, p.id, moduleTeam.id)).toBe(false);
    expect(await links.linkProgrammeTeam(outsider, p.id, moduleTeam.id)).toBe(false);
    expect(await links.linkProgrammeTeam(admin, p.id, "nope")).toBe(false);
    expect(await links.linkProgrammeTeam(admin, "nope", programmeTeam.id)).toBe(false);
    expect((await repo.getProgramme(admin, p.id))?.teams).toHaveLength(1);
  });

  it("is unlinked by an admin or the team's own lead; the last team may go too", async () => {
    const { admin, coordinator, moduleMember, outsider, programmeTeam, moduleTeam, p } =
      await world();
    await links.linkProgrammeTeam(admin, p.id, moduleTeam.id);
    expect(await links.unlinkProgrammeTeam(moduleMember, p.id, moduleTeam.id)).toBe("refused");
    expect(await links.unlinkProgrammeTeam(outsider, p.id, moduleTeam.id)).toBe("refused");
    expect(await links.unlinkProgrammeTeam(coordinator, p.id, moduleTeam.id)).toBe("refused");
    expect(await links.unlinkProgrammeTeam(admin, p.id, moduleTeam.id)).toBe("unlinked");
    expect(await links.unlinkProgrammeTeam(admin, p.id, moduleTeam.id)).toBe("refused");
    // Without a team the programme stays, for the admin to link again.
    expect(await links.unlinkProgrammeTeam(coordinator, p.id, programmeTeam.id)).toBe("unlinked");
    expect(await repo.getProgramme(coordinator, p.id)).toBeNull();
    expect((await repo.getProgramme(admin, p.id))?.teamIds).toEqual([]);
  });

  it("names the programmes a lead can link their team to: all, but those it is in", async () => {
    const { admin, coordinator, moduleLead, moduleMember, moduleTeam, programmeTeam, p } =
      await world();
    const q = (await repo.createProgramme(admin, null, hbo("Zonder team")))!;
    const choices = await links.programmeChoices(moduleLead, moduleTeam.id);
    expect(choices.map((c) => c.id)).toEqual(expect.arrayContaining([p.id, q.id]));
    expect(choices.find((c) => c.id === p.id)).toMatchObject({ name: "Informatica VT" });
    expect(
      (await links.programmeChoices(coordinator, programmeTeam.id)).map((c) => c.id),
    ).not.toContain(p.id);
    expect(await links.programmeChoices(moduleMember, moduleTeam.id)).toEqual([]);
    expect(await links.programmeChoices(coordinator, moduleTeam.id)).toEqual([]);
    expect((await links.programmeChoices(admin, moduleTeam.id)).map((c) => c.id)).toContain(q.id);
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

  it("stays when its teams are deleted, also the last one (BESLUIT-2026-11-16-4)", async () => {
    const { admin, programmeTeam, moduleTeam, p } = await world();
    await links.linkProgrammeTeam(admin, p.id, moduleTeam.id);
    await teams.deleteTeam(programmeTeam.id);
    expect((await repo.getProgramme(admin, p.id))?.teamIds).toEqual([moduleTeam.id]);
    await teams.deleteTeam(moduleTeam.id);
    expect((await repo.getProgramme(admin, p.id))?.teamIds).toEqual([]);
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
