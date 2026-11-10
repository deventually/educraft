import { beforeAll, describe, expect, it } from "vitest";
import type { CourseData } from "~/lib/courses/types";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let lines: typeof import("~/server/repositories/learningLines.server");
let programmes: typeof import("~/server/repositories/programmes.server");
let courses: typeof import("~/server/repositories/courses.server");
let users: typeof import("~/server/repositories/users.server");
let teams: typeof import("~/server/repositories/teams.server");
let shares: typeof import("~/server/repositories/shares.server");

beforeAll(async () => {
  lines = await import("~/server/repositories/learningLines.server");
  programmes = await import("~/server/repositories/programmes.server");
  courses = await import("~/server/repositories/courses.server");
  users = await import("~/server/repositories/users.server");
  teams = await import("~/server/repositories/teams.server");
  shares = await import("~/server/repositories/shares.server");
});

type Actor = { id: string; role: "teacher" | "admin" };
let n = 0;

const withOutcome = (text: string, bloom: "apply" | "create"): CourseData => ({
  outcomes: [{ id: `lo-${text}`, text, bloom }],
  activities: [],
  assessments: [],
});

/** A team (lead L, member M, outsider O) with a programme and three placed courses. */
async function world() {
  n += 1;
  const mk = async (who: string): Promise<Actor> => {
    const u = await users.createUser({
      id: `${who}-ll-${n}`,
      name: `${who} ${n}`,
      passwordHash: "x",
      role: "teacher",
    });
    return { id: u.id, role: "teacher" };
  };
  const [lead, member, outsider] = await Promise.all([mk("L"), mk("M"), mk("O")]);
  const team = await teams.createTeam(`Team ${n}`);
  await teams.addMember(team.id, lead.id);
  await teams.addMember(team.id, member.id);
  await teams.setLead(team.id, lead.id, true);
  const p = await programmes.createProgramme(lead, team.id, { name: "HBO-ICT", sector: "hbo" });
  const mkCourse = async (owner: Actor, name: string, year: number, data: CourseData) => {
    const c = await courses.createCourse(owner.id, { name, data });
    await programmes.placeCourse(owner, p!.id, c.id, { year });
    return c;
  };
  const p1 = await mkCourse(lead, "Programmeren 1", 1, withOutcome("Je schrijft code.", "apply"));
  const p2 = await mkCourse(
    member,
    "Programmeren 2",
    2,
    withOutcome("Je schrijft code.", "create"),
  );
  const db = await mkCourse(
    member,
    "Databases",
    1,
    withOutcome("Je ontwerpt een datamodel.", "apply"),
  );
  return { lead, member, outsider, team, programme: p!, p1, p2, db };
}

describe("learning lines: who manages", () => {
  it("lets the lead create, rename and delete a line; a member reads it; an outsider sees nothing", async () => {
    const { lead, member, outsider, programme, p1, p2 } = await world();
    expect(await lines.createLine(member, programme.id, "Mag niet", [p1.id])).toBeNull();
    const line = await lines.createLine(lead, programme.id, "Programmeren", [p1.id, p2.id]);
    expect(line).toMatchObject({ name: "Programmeren", courseIds: [p1.id, p2.id] });
    expect((await lines.listLines(member, programme.id)).map((l) => l.name)).toEqual([
      "Programmeren",
    ]);
    expect(await lines.listLines(outsider, programme.id)).toEqual([]);
    expect(await lines.getLine(outsider, line!.id)).toBeNull();

    expect(await lines.renameLine(member, line!.id, "Gekaapt")).toBe(false);
    expect(await lines.renameLine(lead, line!.id, "Software")).toBe(true);
    expect(await lines.deleteLine(member, line!.id)).toBe(false);
    expect(await lines.deleteLine(lead, line!.id)).toBe(true);
    expect(await lines.listLines(lead, programme.id)).toEqual([]);
  });

  it("refuses an empty name and a course that is not in the programme", async () => {
    const { lead, programme, p1 } = await world();
    const stray = await courses.createCourse(lead.id, { name: "Niet in de opleiding" });
    expect(await lines.createLine(lead, programme.id, " ", [p1.id])).toBeNull();
    expect(await lines.createLine(lead, programme.id, "Lijn", [p1.id, stray.id])).toBeNull();
  });
});

describe("learning lines: the courses in order", () => {
  it("keeps the chosen order and moves a course up or down", async () => {
    const { lead, programme, p1, p2, db } = await world();
    const line = await lines.createLine(lead, programme.id, "Lijn", [p2.id, p1.id, db.id]);
    expect(await lines.moveCourse(lead, line!.id, p1.id, -1)).toBe(true);
    expect((await lines.getLine(lead, line!.id))?.courses.map((c) => c.name)).toEqual([
      "Programmeren 1",
      "Programmeren 2",
      "Databases",
    ]);
    // The first course can't go further up.
    expect(await lines.moveCourse(lead, line!.id, p1.id, -1)).toBe(false);
  });

  it("sets the courses of a line, and gives the overview with the colleagues' outcomes", async () => {
    const { lead, member, programme, p1, p2 } = await world();
    const line = await lines.createLine(lead, programme.id, "Lijn", [p1.id]);
    expect(await lines.setLineCourses(lead, line!.id, [p1.id, p2.id])).toBe(true);
    const got = await lines.getLine(member, line!.id);
    expect(got?.courses).toEqual([
      expect.objectContaining({
        id: p1.id,
        name: "Programmeren 1",
        outcomes: [expect.objectContaining({ text: "Je schrijft code." })],
      }),
      expect.objectContaining({
        id: p2.id,
        name: "Programmeren 2",
        ownerName: expect.stringContaining("M"),
      }),
    ]);
    expect(got).toMatchObject({
      programmeId: programme.id,
      programmeName: "HBO-ICT",
      canManage: false,
    });
  });

  it("leaves out a course that is no longer in the programme or no longer shared", async () => {
    const { lead, member, team, programme, p1, p2, db } = await world();
    const line = await lines.createLine(lead, programme.id, "Lijn", [p1.id, p2.id, db.id]);
    await shares.stopSharing(member.id, "course", p2.id, team.id);
    await programmes.removeCourse(lead, programme.id, db.id);
    expect((await lines.getLine(lead, line!.id))?.courses.map((c) => c.id)).toEqual([p1.id]);
  });

  it("goes with its programme and its team", async () => {
    const a = await world();
    const l1 = await lines.createLine(a.lead, a.programme.id, "Lijn", [a.p1.id]);
    await programmes.deleteProgramme(a.lead, a.programme.id);
    expect(await lines.getLine({ id: "x", role: "admin" }, l1!.id)).toBeNull();

    const b = await world();
    const l2 = await lines.createLine(b.lead, b.programme.id, "Lijn", [b.p1.id]);
    await teams.deleteTeam(b.team.id);
    expect(await lines.getLine({ id: "x", role: "admin" }, l2!.id)).toBeNull();
  });
});
