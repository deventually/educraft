import { beforeAll, describe, expect, it } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let lines: typeof import("~/server/repositories/learningLines.server");
let programmes: typeof import("~/server/repositories/programmes.server");
let courses: typeof import("~/server/repositories/courses.server");
let users: typeof import("~/server/repositories/users.server");
let teams: typeof import("~/server/repositories/teams.server");

beforeAll(async () => {
  lines = await import("~/server/repositories/learningLines.server");
  programmes = await import("~/server/repositories/programmes.server");
  courses = await import("~/server/repositories/courses.server");
  users = await import("~/server/repositories/users.server");
  teams = await import("~/server/repositories/teams.server");
});

type Actor = { id: string; role: "teacher" | "admin" };
let n = 0;

/**
 * Two programmes of two teams (voltijd A, deeltijd B). `both` leads both teams, `leadA` leads only
 * A; `memberA` and `memberB` each own one placed course in their own programme.
 */
async function world() {
  n += 1;
  const mk = async (who: string, role: "teacher" | "admin" = "teacher"): Promise<Actor> => {
    const u = await users.createUser({
      id: `${who}-sl-${n}`,
      name: `${who} ${n}`,
      passwordHash: "x",
      role,
    });
    return { id: u.id, role };
  };
  const [both, leadA, memberA, memberB, admin] = await Promise.all([
    mk("Both"),
    mk("LeadA"),
    mk("MemberA"),
    mk("MemberB"),
    mk("Admin", "admin"),
  ]);
  const teamA = await teams.createTeam(`Voltijd ${n}`);
  const teamB = await teams.createTeam(`Deeltijd ${n}`);
  for (const u of [both, leadA, memberA]) await teams.addMember(teamA.id, u.id);
  for (const u of [both, memberB]) await teams.addMember(teamB.id, u.id);
  await teams.setLead(teamA.id, both.id, true);
  await teams.setLead(teamA.id, leadA.id, true);
  await teams.setLead(teamB.id, both.id, true);
  const a = (await programmes.createProgramme(both, teamA.id, {
    name: "Pabo voltijd",
    sector: "hbo",
  }))!;
  const b = (await programmes.createProgramme(both, teamB.id, {
    name: "Pabo deeltijd",
    sector: "hbo",
  }))!;
  const cA = await courses.createCourse(memberA.id, { name: "Onderzoek 1" });
  await programmes.placeCourse(memberA, a.id, cA.id, { year: 1 });
  const cB = await courses.createCourse(memberB.id, { name: "Onderzoek 2 (dt)" });
  await programmes.placeCourse(memberB, b.id, cB.id, { year: 2 });
  return { both, leadA, memberA, memberB, admin, a, b, cA, cB };
}

describe("a learning line across programmes", () => {
  it("is linked to another programme by someone who manages both, and shows up there", async () => {
    const { both, memberB, a, b, cA } = await world();
    const line = (await lines.createLine(both, a.id, "Onderzoek", [cA.id]))!;
    expect(await lines.setLineProgrammes(both, line.id, [b.id])).toBe(true);
    const inB = await lines.listLines(memberB, b.id);
    expect(inB).toEqual([expect.objectContaining({ id: line.id, programmeId: a.id })]);
    expect((await lines.getLine(both, line.id))?.programmes.map((p) => p.id)).toEqual([a.id, b.id]);
  });

  it("refuses a lead who does not manage the other programme; an admin may", async () => {
    const { leadA, admin, a, b, cA } = await world();
    const line = (await lines.createLine(leadA, a.id, "Onderzoek", [cA.id]))!;
    expect(await lines.setLineProgrammes(leadA, line.id, [b.id])).toBe(false);
    expect(await lines.setLineProgrammes(admin, line.id, [b.id])).toBe(true);
  });

  it("takes courses from every linked programme, and each reader sees only what is shared with them", async () => {
    const { both, memberA, memberB, a, b, cA, cB } = await world();
    const line = (await lines.createLine(both, a.id, "Onderzoek", [cA.id]))!;
    // Not linked yet: a course of B is not allowed.
    expect(await lines.setLineCourses(both, line.id, [cA.id, cB.id])).toBe(false);
    await lines.setLineProgrammes(both, line.id, [b.id]);
    expect(await lines.setLineCourses(both, line.id, [cA.id, cB.id])).toBe(true);
    expect((await lines.getLine(both, line.id))?.courses.map((c) => c.name)).toEqual([
      "Onderzoek 1",
      "Onderzoek 2 (dt)",
    ]);
    expect((await lines.getLine(memberB, line.id))?.courses.map((c) => c.name)).toEqual([
      "Onderzoek 2 (dt)",
    ]);
    expect((await lines.getLine(memberA, line.id))?.courses.map((c) => c.name)).toEqual([
      "Onderzoek 1",
    ]);
    // Only the home programme's managers manage the line.
    expect((await lines.getLine(memberB, line.id))?.canManage).toBe(false);
  });

  it("disappears from a programme that is unlinked or deleted", async () => {
    const { both, memberB, a, b, cA } = await world();
    const line = (await lines.createLine(both, a.id, "Onderzoek", [cA.id]))!;
    await lines.setLineProgrammes(both, line.id, [b.id]);
    expect(await lines.setLineProgrammes(both, line.id, [])).toBe(true);
    expect(await lines.listLines(memberB, b.id)).toEqual([]);
    expect(await lines.getLine(memberB, line.id)).toBeNull();
    await lines.setLineProgrammes(both, line.id, [b.id]);
    await programmes.deleteProgramme(both, b.id);
    expect(await lines.getLine(memberB, line.id)).toBeNull();
    expect((await lines.getLine(both, line.id))?.programmes.map((p) => p.id)).toEqual([a.id]);
  });

  it("ignores the home programme and duplicates in the list, and refuses an unknown one", async () => {
    const { both, a, b, cA } = await world();
    const line = (await lines.createLine(both, a.id, "Onderzoek", [cA.id]))!;
    expect(await lines.setLineProgrammes(both, line.id, [a.id, b.id, b.id])).toBe(true);
    expect((await lines.getLine(both, line.id))?.programmes.map((p) => p.id)).toEqual([a.id, b.id]);
    expect(await lines.setLineProgrammes(both, line.id, ["nope"])).toBe(false);
  });
});

describe("where a course sits in its learning lines (the course page)", () => {
  it("gives the place, the total and the courses before and after", async () => {
    const { both, memberA, a, cA } = await world();
    const c2 = await courses.createCourse(memberA.id, { name: "Onderzoek 3" });
    await programmes.placeCourse(memberA, a.id, c2.id, { year: 3 });
    const c0 = await courses.createCourse(memberA.id, { name: "Onderzoek 0" });
    await programmes.placeCourse(memberA, a.id, c0.id, { year: 1 });
    const line = (await lines.createLine(both, a.id, "Onderzoek", [c0.id, cA.id, c2.id]))!;
    expect(await lines.linesOfCourse(memberA, cA.id)).toEqual([
      {
        lineId: line.id,
        name: "Onderzoek",
        programmeId: a.id,
        position: 2,
        total: 3,
        previous: { id: c0.id, name: "Onderzoek 0" },
        next: { id: c2.id, name: "Onderzoek 3" },
      },
    ]);
  });

  it("shows nothing to someone who cannot read any of the line's programmes", async () => {
    const { both, memberB, a, cA } = await world();
    await lines.createLine(both, a.id, "Onderzoek", [cA.id]);
    expect(await lines.linesOfCourse(memberB, cA.id)).toEqual([]);
  });
});
