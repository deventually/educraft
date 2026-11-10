import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { alignedCourse } from "../courses/fixtures";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let transfer: typeof import("~/server/repositories/courseTransfer.server");
let members: typeof import("~/server/repositories/courseMembers.server");
let courses: typeof import("~/server/repositories/courses.server");
let shares: typeof import("~/server/repositories/shares.server");
let profiles: typeof import("~/server/repositories/profiles.server");
let teams: typeof import("~/server/repositories/teams.server");
let users: typeof import("~/server/repositories/users.server");
let reviews: typeof import("~/server/repositories/agentReviews.server");
let programmes: typeof import("~/server/repositories/programmes.server");

let n = 0;
/** A fresh owner A, team-mates B and D, outsider C and a team with A, B and D in it. */
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
  const team = await teams.createTeam(`Team ${n}`);
  for (const u of [a, b, d]) await teams.addMember(team.id, u.id);
  return { a: a.id, b: b.id, c: c.id, d: d.id, team: team.id };
}

beforeAll(async () => {
  transfer = await import("~/server/repositories/courseTransfer.server");
  members = await import("~/server/repositories/courseMembers.server");
  courses = await import("~/server/repositories/courses.server");
  shares = await import("~/server/repositories/shares.server");
  profiles = await import("~/server/repositories/profiles.server");
  teams = await import("~/server/repositories/teams.server");
  users = await import("~/server/repositories/users.server");
  reviews = await import("~/server/repositories/agentReviews.server");
  programmes = await import("~/server/repositories/programmes.server");
});

let w: Awaited<ReturnType<typeof world>>;
beforeEach(async () => {
  w = await world();
});

const newCourse = (owner: string, name = "Statistiek") =>
  courses.createCourse(owner, { name, data: alignedCourse() });

const roles = async (viewer: string, courseId: string) =>
  (await members.listCourseMembers(viewer, courseId)).map((m) => [m.userId, m.role]);

describe("handing a course over (BESLUIT-2026-11-10-5)", () => {
  it("offers the owner's team-mates, never an outsider, and nothing to a member", async () => {
    const course = await newCourse(w.a);
    expect((await transfer.listTransferCandidates(w.a, course.id)).map((c) => c.userId)).toEqual([
      w.b,
      w.d,
    ]);
    await members.setCourseMember(w.a, course.id, w.b, "co-owner");
    expect(await transfer.listTransferCandidates(w.b, course.id)).toEqual([]);
  });

  it("moves ownership at once and keeps the old owner as editor", async () => {
    const profile = await profiles.createProfile(w.a, { name: "Profiel A" });
    const course = await courses.createCourse(w.a, {
      name: "Statistiek",
      contextProfileId: profile.id,
      data: alignedCourse(),
    });
    await members.setCourseMember(w.a, course.id, w.b, "co-owner");
    expect(await transfer.transferCourse(w.a, course.id, w.b, true)).toBe(true);

    const mine = await courses.getCourse(w.b, course.id);
    expect(mine).toMatchObject({ ownerId: w.b, role: "owner", contextProfileId: null });
    expect(await roles(w.b, course.id)).toEqual([[w.a, "editor"]]);
    expect(await courses.deleteCourse(w.a, course.id)).toBe(false);
    expect(await courses.deleteCourse(w.b, course.id)).toBe(true);
  });

  it("lets the old owner leave the course altogether", async () => {
    const course = await newCourse(w.a);
    expect(await transfer.transferCourse(w.a, course.id, w.d, false)).toBe(true);
    expect(await courses.getCourse(w.a, course.id)).toBeNull();
    expect(await roles(w.d, course.id)).toEqual([]);
  });

  it("refuses an outsider, the owner themselves and a caller who is not the owner", async () => {
    const course = await newCourse(w.a);
    expect(await transfer.transferCourse(w.a, course.id, w.c, true)).toBe(false);
    expect(await transfer.transferCourse(w.a, course.id, w.a, true)).toBe(false);
    await members.setCourseMember(w.a, course.id, w.b, "co-owner");
    expect(await transfer.transferCourse(w.b, course.id, w.d, true)).toBe(false);
    expect((await courses.getCourse(w.a, course.id))?.ownerId).toBe(w.a);
  });

  it("takes the owner's shares and programme places along", async () => {
    const course = await newCourse(w.a);
    const lead = { id: w.a, role: "teacher" as const };
    await teams.setLead(w.team, w.a, true);
    const programme = await programmes.createProgramme(lead, w.team, {
      name: "Bachelor",
      sector: "hbo",
      track: "bachelor",
    });
    expect(programme).not.toBeNull();
    expect(await programmes.placeCourse(lead, programme!.id, course.id, {})).toBe(true);

    await transfer.transferCourse(w.a, course.id, w.b, false);
    expect(await shares.listItemShares(w.b, "course", course.id)).toEqual([w.team]);
    expect((await programmes.programmesOfCourse(course.id)).map((p) => p.programmeId)).toEqual([
      programme!.id,
    ]);
  });

  it("leaves reviews with whoever made them", async () => {
    const course = await newCourse(w.a);
    await reviews.saveReview(w.a, {
      courseId: course.id,
      agentId: "designer",
      model: "m",
      findings: [],
    });
    await transfer.transferCourse(w.a, course.id, w.b, true);
    expect(await reviews.listReviewsForCourse(w.a, course.id)).toHaveLength(1);
    expect(await reviews.listReviewsForCourse(w.b, course.id)).toEqual([]);
  });
});

describe("an admin's hand-over (BESLUIT-2026-11-10-5)", () => {
  it("hands one course, or all of them, to any active colleague", async () => {
    const one = await newCourse(w.a, "Een");
    const two = await newCourse(w.a, "Twee");
    expect(await transfer.adminTransferCourse(w.a, one.id, w.c, false)).toBe(true);
    expect((await courses.getCourse(w.c, one.id))?.ownerId).toBe(w.c);
    // Only a course of the person on the page.
    expect(await transfer.adminTransferCourse(w.a, one.id, w.d, false)).toBe(false);

    expect(await transfer.adminTransferAll(w.a, w.d, true)).toBe(1);
    expect((await courses.getCourse(w.d, two.id))?.ownerId).toBe(w.d);
    expect(await roles(w.d, two.id)).toEqual([[w.a, "editor"]]);
  });

  it("works when the teacher is disabled, never towards a disabled colleague", async () => {
    const course = await newCourse(w.a);
    await users.setUserDisabled(w.a, true);
    await users.setUserDisabled(w.c, true);
    expect(await transfer.adminTransferCourse(w.a, course.id, w.c, false)).toBe(false);
    expect(await transfer.adminTransferCourse(w.a, course.id, w.b, false)).toBe(true);
  });

  it("lists a teacher's courses with their members", async () => {
    const course = await newCourse(w.a);
    await members.setCourseMember(w.a, course.id, w.b, "editor");
    expect(await transfer.listOwnedCourses(w.a)).toEqual([
      {
        id: course.id,
        name: "Statistiek",
        members: [{ userId: w.b, name: `B ${n}`, role: "editor" }],
      },
    ]);
  });

  it("adds and removes members of a teacher's course, outside any team", async () => {
    const course = await newCourse(w.a);
    expect(await transfer.adminSetCourseMember(w.a, course.id, w.c, "co-owner")).toBe(true);
    expect(await transfer.adminSetCourseMember(w.a, course.id, w.a, "editor")).toBe(false);
    expect(await transfer.adminSetCourseMember(w.b, course.id, w.d, "editor")).toBe(false);
    expect(await roles(w.a, course.id)).toEqual([[w.c, "co-owner"]]);
    expect(await transfer.adminRemoveCourseMember(w.a, course.id, w.c)).toBe(true);
    expect(await roles(w.a, course.id)).toEqual([]);
  });
});

describe("a departing account's courses (BESLUIT-2026-11-10-5)", () => {
  it("go to the earliest co-owner when the account is deleted; the rest go", async () => {
    const shared = await newCourse(w.a, "Samen");
    const alone = await newCourse(w.a, "Alleen");
    await members.setCourseMember(w.a, shared.id, w.b, "editor");
    await members.setCourseMember(w.a, shared.id, w.d, "co-owner");
    await members.setCourseMember(w.a, alone.id, w.b, "editor");
    expect(await transfer.countCoursesWithoutSuccessor(w.a)).toBe(1);

    await users.deleteUserCascade(w.a);
    expect(await courses.getCourse(w.d, shared.id)).toMatchObject({ ownerId: w.d, role: "owner" });
    expect(await roles(w.d, shared.id)).toEqual([[w.b, "editor"]]);
    expect(await courses.getCourse(w.b, alone.id)).toBeNull();
  });
});
