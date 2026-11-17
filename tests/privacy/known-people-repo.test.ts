import { beforeAll, describe, expect, it } from "vitest";
import { alignedCourse } from "../courses/fixtures";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let known: typeof import("~/server/repositories/knownPeople.server");
let courseTeams: typeof import("~/server/repositories/courseTeams.server");
let members: typeof import("~/server/repositories/courseMembers.server");
let courses: typeof import("~/server/repositories/courses.server");
let teams: typeof import("~/server/repositories/teams.server");
let users: typeof import("~/server/repositories/users.server");

beforeAll(async () => {
  known = await import("~/server/repositories/knownPeople.server");
  courseTeams = await import("~/server/repositories/courseTeams.server");
  members = await import("~/server/repositories/courseMembers.server");
  courses = await import("~/server/repositories/courses.server");
  teams = await import("~/server/repositories/teams.server");
  users = await import("~/server/repositories/users.server");
});

const mk = (id: string, name: string) =>
  users.createUser({ id, name, passwordHash: "x", role: "teacher" });

/**
 * The names the server gate knows (anonymiseerpoort PR 2): the teacher, the members of their
 * teams, and everyone on a course they work on. Not the whole institution.
 */
describe("listKnownPeople", () => {
  it("knows the teacher, their team-mates and the people on their courses, nobody else", async () => {
    await mk("kp-a", "Mark de Groot");
    await mk("kp-team", "Fatima el Amrani");
    await mk("kp-owner", "Roos Jansen");
    await mk("kp-linked", "Pieter Bakker");
    await mk("kp-editor", "Sanne Visser");
    await mk("kp-outsider", "Onbekend Iemand");
    const team = await teams.createTeam("Moduleteam KP");
    await teams.addMember(team.id, "kp-a");
    await teams.addMember(team.id, "kp-team");

    // A course of someone else that the teacher edits, with its own editor.
    const theirs = await courses.createCourse("kp-owner", {
      name: "Netwerken",
      data: alignedCourse(),
    });
    const ownerTeam = await teams.createTeam("Team eigenaar KP");
    for (const id of ["kp-owner", "kp-a", "kp-editor"]) await teams.addMember(ownerTeam.id, id);
    expect(await members.setCourseMember("kp-owner", theirs.id, "kp-a", "editor")).toBe(true);
    expect(await members.setCourseMember("kp-owner", theirs.id, "kp-editor", "editor")).toBe(true);
    await teams.removeMember(ownerTeam.id, "kp-editor");
    await teams.removeMember(ownerTeam.id, "kp-owner");

    // The teacher's own course, with a linked team.
    const own = await courses.createCourse("kp-a", { name: "Databases", data: alignedCourse() });
    const linked = await teams.createTeam("Gekoppeld KP");
    await teams.addMember(linked.id, "kp-linked");
    await teams.addMember(linked.id, "kp-a");
    expect(await courseTeams.linkCourseTeam("kp-a", own.id, linked.id, "editor")).toBe(true);
    await teams.removeMember(linked.id, "kp-a");

    const people = await known.listKnownPeople("kp-a");
    expect(people.teacher).toBe("Mark de Groot");
    expect([...people.colleagues].sort()).toEqual(
      ["Fatima el Amrani", "Pieter Bakker", "Roos Jansen", "Sanne Visser"].sort(),
    );
  });

  it("knows only the teacher when they work alone, and nothing for an unknown id", async () => {
    await mk("kp-alone", "Eva Smit");
    expect(await known.listKnownPeople("kp-alone")).toEqual({
      teacher: "Eva Smit",
      colleagues: [],
    });
    expect(await known.listKnownPeople("kp-nobody")).toEqual({ colleagues: [] });
  });
});
