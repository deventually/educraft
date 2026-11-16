import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { alignedCourse } from "../courses/fixtures";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let courseTeams: typeof import("~/server/repositories/courseTeams.server");
let members: typeof import("~/server/repositories/courseMembers.server");
let courses: typeof import("~/server/repositories/courses.server");
let shares: typeof import("~/server/repositories/shares.server");
let teams: typeof import("~/server/repositories/teams.server");
let users: typeof import("~/server/repositories/users.server");
let programmes: typeof import("~/server/repositories/programmes.server");

let n = 0;
/** Owner A in module team M with B and D; outsider C in team X (with B, not A). */
async function world() {
  n += 1;
  const mk = (who: string) =>
    users.createUser({
      id: `${who}-${n}`,
      name: `${who} ${n}`,
      passwordHash: "x",
      role: "teacher",
    });
  const [a, b, c, d] = await Promise.all([mk("A"), mk("B"), mk("C"), mk("D")]);
  const module = await teams.createTeam(`Moduleteam ${n}`);
  for (const u of [a, b, d]) await teams.addMember(module.id, u.id);
  const other = await teams.createTeam(`Anders ${n}`);
  for (const u of [b, c]) await teams.addMember(other.id, u.id);
  return { a: a.id, b: b.id, c: c.id, d: d.id, module: module.id, other: other.id };
}

beforeAll(async () => {
  courseTeams = await import("~/server/repositories/courseTeams.server");
  members = await import("~/server/repositories/courseMembers.server");
  courses = await import("~/server/repositories/courses.server");
  shares = await import("~/server/repositories/shares.server");
  teams = await import("~/server/repositories/teams.server");
  users = await import("~/server/repositories/users.server");
  programmes = await import("~/server/repositories/programmes.server");
});

let w: Awaited<ReturnType<typeof world>>;
beforeEach(async () => {
  w = await world();
});

const newCourse = (owner: string, name = "Databases") =>
  courses.createCourse(owner, { name, data: alignedCourse() });

describe("a module team on a course (BESLUIT-2026-11-16-2)", () => {
  it("lets every member of a linked team work on the course; it stays the owner's", async () => {
    const course = await newCourse(w.a);
    expect(await courseTeams.linkCourseTeam(w.a, course.id, w.module, "editor")).toBe(true);
    expect((await courses.getCourse(w.b, course.id))?.role).toBe("editor");
    expect((await courses.getCourse(w.d, course.id))?.role).toBe("editor");
    expect(await courses.getCourse(w.c, course.id)).toBeNull();
    expect((await courses.getCourse(w.a, course.id))?.role).toBe("owner");
    expect((await courses.listCourses(w.b)).map((c) => c.id)).toContain(course.id);
    expect(await courseTeams.listCourseTeams(w.b, course.id)).toEqual([
      { id: w.module, name: `Moduleteam ${n}`, role: "editor", members: [`B ${n}`, `D ${n}`] },
    ]);
  });

  it("follows the team: who joins works on it, who leaves loses it", async () => {
    const course = await newCourse(w.a);
    await courseTeams.linkCourseTeam(w.a, course.id, w.module, "editor");
    await teams.addMember(w.module, w.c);
    expect((await courses.getCourse(w.c, course.id))?.role).toBe("editor");
    await teams.removeMember(w.module, w.b);
    expect(await courses.getCourse(w.b, course.id)).toBeNull();
    await teams.setUserTeams(w.d, [], []);
    expect(await courses.getCourse(w.d, course.id)).toBeNull();
  });

  it("gives a co-owner team the management, but no hand-over or delete", async () => {
    const course = await newCourse(w.a);
    await courseTeams.linkCourseTeam(w.a, course.id, w.module, "co-owner");
    expect((await courses.getCourse(w.b, course.id))?.role).toBe("co-owner");
    expect(await members.canManageCourse(w.b, course.id)).toBe(true);
    expect(await shares.shareItem(w.b, "course", course.id, w.other)).toBe(true);
    expect(await courses.deleteCourse(w.b, course.id)).toBe(false);
  });

  it("lets a co-owner through a team place the course in a programme of that team", async () => {
    const course = await newCourse(w.a);
    await courseTeams.linkCourseTeam(w.a, course.id, w.module, "co-owner");
    const b = { id: w.b, role: "teacher" as const };
    const p = await programmes.createProgramme({ id: w.a, role: "admin" }, w.other, {
      name: "Informatica",
      sector: "hbo",
      track: "bachelor",
    });
    expect(await programmes.placeCourse(b, p!.id, course.id, { year: 1 })).toBe(true);
    expect(programmes.listProgrammeCourses(p!.id).map((c) => c.courseId)).toEqual([course.id]);
    // B leaves the module team: no longer co-owner, so the course leaves the programme.
    await teams.removeMember(w.module, w.b);
    expect(programmes.listProgrammeCourses(p!.id)).toEqual([]);
  });

  it("keeps the stronger role when someone is both a member and in a linked team", async () => {
    const course = await newCourse(w.a);
    await members.setCourseMember(w.a, course.id, w.b, "co-owner");
    await courseTeams.linkCourseTeam(w.a, course.id, w.module, "editor");
    expect((await courses.getCourse(w.b, course.id))?.role).toBe("co-owner");
    // Taken off by hand, B still works on it through the team.
    await members.removeCourseMember(w.a, course.id, w.b);
    expect((await courses.getCourse(w.b, course.id))?.role).toBe("editor");
  });

  it("refuses a team the caller is not in, an editor, and an unknown role", async () => {
    const course = await newCourse(w.a);
    expect(await courseTeams.linkCourseTeam(w.a, course.id, w.other, "editor")).toBe(false);
    await members.setCourseMember(w.a, course.id, w.b, "editor");
    expect(await courseTeams.linkCourseTeam(w.b, course.id, w.module, "editor")).toBe(false);
    expect(await courseTeams.linkCourseTeam(w.a, course.id, w.module, "boss" as never)).toBe(false);
    expect(await courseTeams.listCourseTeams(w.a, course.id)).toEqual([]);
  });

  it("lets a manager change the team's role and unlink it", async () => {
    const course = await newCourse(w.a);
    await courseTeams.linkCourseTeam(w.a, course.id, w.module, "editor");
    expect(await courseTeams.linkCourseTeam(w.a, course.id, w.module, "co-owner")).toBe(true);
    expect((await courses.getCourse(w.d, course.id))?.role).toBe("co-owner");
    expect(await courseTeams.unlinkCourseTeam(w.d, course.id, w.module)).toBe(true);
    expect(await courses.getCourse(w.d, course.id)).toBeNull();
    expect(await courseTeams.unlinkCourseTeam(w.a, course.id, w.module)).toBe(false);
  });

  it("offers a manager their own teams that are not linked yet", async () => {
    const course = await newCourse(w.a);
    expect(await courseTeams.listTeamCandidates(w.a, course.id)).toEqual([
      { id: w.module, name: `Moduleteam ${n}` },
    ]);
    await courseTeams.linkCourseTeam(w.a, course.id, w.module, "editor");
    expect(await courseTeams.listTeamCandidates(w.a, course.id)).toEqual([]);
    expect(await courseTeams.listTeamCandidates(w.b, course.id)).toEqual([]);
  });

  it("shows the linked teams to the owner and members only", async () => {
    const course = await newCourse(w.a);
    await courseTeams.linkCourseTeam(w.a, course.id, w.module, "editor");
    expect(await courseTeams.listCourseTeams(w.c, course.id)).toEqual([]);
  });

  it("drops the link when the team goes, and with the course", async () => {
    const course = await newCourse(w.a);
    const second = await newCourse(w.a, "Tweede");
    await courseTeams.linkCourseTeam(w.a, course.id, w.module, "editor");
    await courseTeams.linkCourseTeam(w.a, second.id, w.module, "editor");
    expect(await courses.deleteCourse(w.a, second.id)).toBe(true);
    await teams.deleteTeam(w.module);
    expect(await courses.getCourse(w.b, course.id)).toBeNull();
    expect(await courseTeams.listCourseTeams(w.a, course.id)).toEqual([]);
  });
});
