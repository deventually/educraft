import { beforeAll, describe, expect, it } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let repo: typeof import("~/server/repositories/programmes.server");
let courses: typeof import("~/server/repositories/courses.server");
let users: typeof import("~/server/repositories/users.server");
let teams: typeof import("~/server/repositories/teams.server");
let shares: typeof import("~/server/repositories/shares.server");

beforeAll(async () => {
  repo = await import("~/server/repositories/programmes.server");
  courses = await import("~/server/repositories/courses.server");
  users = await import("~/server/repositories/users.server");
  teams = await import("~/server/repositories/teams.server");
  shares = await import("~/server/repositories/shares.server");
});

type Actor = { id: string; role: "teacher" | "admin" };
let n = 0;

/** A fresh team with lead L and member M, an outsider O and an admin A (not in the team). */
async function world() {
  n += 1;
  const mk = async (who: string, role: "teacher" | "admin" = "teacher"): Promise<Actor> => {
    const u = await users.createUser({
      id: `${who}-${n}`,
      name: `${who} ${n}`,
      passwordHash: "x",
      role,
    });
    return { id: u.id, role };
  };
  const [lead, member, outsider, admin] = await Promise.all([
    mk("L"),
    mk("M"),
    mk("O"),
    mk("A", "admin"),
  ]);
  const team = await teams.createTeam(`Informatica ${n}`);
  await teams.addMember(team.id, lead.id);
  await teams.addMember(team.id, member.id);
  await teams.setLead(team.id, lead.id, true);
  return { lead, member, outsider, admin, team };
}

const hbo = (name: string) => ({ name, sector: "hbo", track: "bachelor" });

describe("programmes of a team: who manages", () => {
  it("lets the team lead and an admin create, rename and delete; a member or outsider not", async () => {
    const { lead, member, outsider, admin, team } = await world();
    expect(await repo.createProgramme(member, team.id, hbo("Mag niet"))).toBeNull();
    expect(await repo.createProgramme(outsider, team.id, hbo("Mag niet"))).toBeNull();
    const p = await repo.createProgramme(lead, team.id, hbo("HBO-ICT"));
    expect(p).toMatchObject({ name: "HBO-ICT", teamId: team.id });
    const q = await repo.createProgramme(admin, team.id, hbo("Master"));
    expect(q).not.toBeNull();

    expect(await repo.updateProgramme(member, p!.id, hbo("Gekaapt"))).toBeNull();
    expect(
      await repo.updateProgramme(lead, p!.id, { ...hbo("HBO-ICT deeltijd"), form: "parttime" }),
    ).toMatchObject({ name: "HBO-ICT deeltijd", form: "parttime" });
    expect(await repo.deleteProgramme(member, q!.id)).toBe(false);
    expect(await repo.deleteProgramme(admin, q!.id)).toBe(true);
  });

  it("refuses invalid input before writing", async () => {
    const { lead, team } = await world();
    await expect(
      repo.createProgramme(lead, team.id, { name: "x", sector: "hbo", track: "phd" }),
    ).rejects.toThrow();
    expect(await repo.listProgrammes(lead)).toEqual([]);
  });

  it("names the teams a person may create a programme for", async () => {
    const { lead, member, admin, team } = await world();
    expect(await repo.manageableTeams(lead)).toEqual([{ id: team.id, name: team.name }]);
    expect(await repo.manageableTeams(member)).toEqual([]);
    expect((await repo.manageableTeams(admin)).map((t) => t.id)).toContain(team.id);
  });
});

describe("programmes of a team: who reads", () => {
  it("shows a programme to every member and an admin, never to an outsider", async () => {
    const { lead, member, outsider, admin, team } = await world();
    const p = await repo.createProgramme(lead, team.id, hbo("HBO-ICT"));
    expect((await repo.listProgrammes(member)).map((x) => x.name)).toEqual(["HBO-ICT"]);
    expect(await repo.listProgrammes(member)).toEqual([
      expect.objectContaining({ teamName: team.name, canManage: false, courseCount: 0 }),
    ]);
    expect(await repo.listProgrammes(lead)).toEqual([expect.objectContaining({ canManage: true })]);
    expect(await repo.listProgrammes(outsider)).toEqual([]);
    expect(await repo.getProgramme(outsider, p!.id)).toBeNull();
    expect(await repo.getProgramme(admin, p!.id)).toMatchObject({ canManage: true });
  });
});

describe("courses in a programme", () => {
  it("lets a member place an own course, which shares it with the team", async () => {
    const { lead, member, team } = await world();
    const p = await repo.createProgramme(lead, team.id, hbo("Voltijd"));
    const c = await courses.createCourse(member.id, { name: "Programmeren 1" });

    expect(await repo.placeCourse(member, p!.id, c.id, { year: 1, period: 2 })).toBe(true);
    expect(await shares.listItemShares(member.id, "course", c.id)).toEqual([team.id]);
    // The lead sees the colleague's course, with its owner and place.
    expect((await repo.getProgramme(lead, p!.id))?.courses).toEqual([
      {
        courseId: c.id,
        name: "Programmeren 1",
        ownerId: member.id,
        ownerName: expect.stringContaining("M"),
        year: 1,
        period: 2,
      },
    ]);
    expect((await repo.listProgrammes(lead))[0]?.courseCount).toBe(1);
  });

  it("places one course in several programmes, each with its own place; placing again moves it", async () => {
    const { lead, member, team } = await world();
    const vt = await repo.createProgramme(lead, team.id, { ...hbo("Voltijd"), form: "fulltime" });
    const dt = await repo.createProgramme(lead, team.id, { ...hbo("Deeltijd"), form: "parttime" });
    const c = await courses.createCourse(member.id, { name: "Databases" });
    await repo.placeCourse(member, vt!.id, c.id, { year: 1, period: 1 });
    await repo.placeCourse(member, dt!.id, c.id, { year: 2, period: 3 });
    await repo.placeCourse(member, vt!.id, c.id, { year: 1, period: 2 });
    expect(await repo.programmesOfCourse(member.id, c.id)).toEqual([
      { programmeId: dt!.id, name: "Deeltijd", teamName: team.name, year: 2, period: 3 },
      { programmeId: vt!.id, name: "Voltijd", teamName: team.name, year: 1, period: 2 },
    ]);
  });

  it("orders the courses by year, period and name, unplaced last", async () => {
    const { lead, member, team } = await world();
    const p = await repo.createProgramme(lead, team.id, hbo("Opleiding"));
    for (const [name, placement] of [
      ["Zonder plek", {}],
      ["Jaar 2", { year: 2, period: 1 }],
      ["B jaar 1", { year: 1, period: 3 }],
      ["A jaar 1", { year: 1, period: 3 }],
      ["Jaar 1 p1", { year: 1, period: 1 }],
    ] as const) {
      const c = await courses.createCourse(member.id, { name });
      await repo.placeCourse(member, p!.id, c.id, placement);
    }
    expect((await repo.getProgramme(member, p!.id))?.courses.map((c) => c.name)).toEqual([
      "Jaar 1 p1",
      "A jaar 1",
      "B jaar 1",
      "Jaar 2",
      "Zonder plek",
    ]);
  });

  it("never places someone else's course, nor in a team the owner is not in", async () => {
    const { lead, member, outsider, team } = await world();
    const p = await repo.createProgramme(lead, team.id, hbo("Opleiding"));
    const theirs = await courses.createCourse(member.id, { name: "Van M" });
    const outsiders = await courses.createCourse(outsider.id, { name: "Van O" });
    const mine = await courses.createCourse(lead.id, { name: "Van L" });
    expect(await repo.placeCourse(lead, p!.id, theirs.id, {})).toBe(false);
    expect(await repo.placeCourse(outsider, p!.id, outsiders.id, {})).toBe(false);
    expect(await repo.placeCourse(lead, p!.id, mine.id, { year: 0 })).toBe(false);
    expect((await repo.getProgramme(lead, p!.id))?.courses).toEqual([]);
  });

  it("lets the owner or the lead take a course out; another member not", async () => {
    const { lead, member, team } = await world();
    const other = await users.createUser({
      id: `X-${n}`,
      name: "X",
      passwordHash: "x",
      role: "teacher",
    });
    await teams.addMember(team.id, other.id);
    const p = await repo.createProgramme(lead, team.id, hbo("Opleiding"));
    const c1 = await courses.createCourse(member.id, { name: "Eén" });
    const c2 = await courses.createCourse(member.id, { name: "Twee" });
    await repo.placeCourse(member, p!.id, c1.id, {});
    await repo.placeCourse(member, p!.id, c2.id, {});
    expect(await repo.removeCourse({ id: other.id, role: "teacher" }, p!.id, c1.id)).toBe(false);
    expect(await repo.removeCourse(member, p!.id, c1.id)).toBe(true);
    expect(await repo.removeCourse(lead, p!.id, c2.id)).toBe(true);
    expect((await repo.getProgramme(lead, p!.id))?.courses).toEqual([]);
  });

  it("drops a course when it is no longer shared, deleted, or its owner leaves the team", async () => {
    const { lead, member, team } = await world();
    const p = await repo.createProgramme(lead, team.id, hbo("Opleiding"));
    const [a, b, c] = await Promise.all(
      ["Gestopt", "Verwijderd", "Vertrokken"].map((name) =>
        courses.createCourse(member.id, { name }),
      ),
    );
    for (const x of [a!, b!, c!]) await repo.placeCourse(member, p!.id, x.id, {});
    await shares.stopSharing(member.id, "course", a!.id, team.id);
    expect(await repo.programmesOfCourse(member.id, a!.id)).toEqual([]);
    await courses.deleteCourse(member.id, b!.id);
    expect((await repo.getProgramme(lead, p!.id))?.courses.map((x) => x.name)).toEqual([
      "Vertrokken",
    ]);
    await teams.removeMember(team.id, member.id);
    expect((await repo.getProgramme(lead, p!.id))?.courses).toEqual([]);
    expect(await repo.programmesOfCourse(member.id, c!.id)).toEqual([]);
  });

  it("goes with its team", async () => {
    const { lead, member, team } = await world();
    const p = await repo.createProgramme(lead, team.id, hbo("Opleiding"));
    const c = await courses.createCourse(member.id, { name: "Cursus" });
    await repo.placeCourse(member, p!.id, c.id, {});
    await teams.deleteTeam(team.id);
    expect(await repo.getProgramme({ id: lead.id, role: "admin" }, p!.id)).toBeNull();
    expect(await repo.programmesOfCourse(member.id, c.id)).toEqual([]);
  });

  it("offers a member the programmes of all their teams on the course page", async () => {
    const { lead, member, outsider, team } = await world();
    await repo.createProgramme(lead, team.id, hbo("Voltijd"));
    expect(await repo.placeOptions(member.id)).toEqual([
      expect.objectContaining({ name: "Voltijd", teamName: team.name }),
    ]);
    expect(await repo.placeOptions(outsider.id)).toEqual([]);
  });
});
