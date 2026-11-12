import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";
import { ACT1, alignedCourse } from "./fixtures";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let courses: typeof import("~/server/repositories/courses.server");
let members: typeof import("~/server/repositories/courseMembers.server");
let courseDetail: typeof import("~/routes/courses.$id");

beforeAll(async () => {
  courses = await import("~/server/repositories/courses.server");
  members = await import("~/server/repositories/courseMembers.server");
  courseDetail = await import("~/routes/courses.$id");
  const users = await import("~/server/repositories/users.server");
  for (const [id, name] of [
    ["imp-a", "Anna"],
    ["imp-b", "Bram"],
    ["imp-c", "Cas"],
  ] as const)
    await users.createUser({ id, name, passwordHash: "x", role: "teacher" });
  // A course member is always a teammate of the owner.
  const teams = await import("~/server/repositories/teams.server");
  const team = (await teams.createTeam("Statistiek")).id;
  await teams.addMember(team, "imp-a");
  await teams.addMember(team, "imp-b");
});

beforeEach(() => signInAs({ id: "imp-a" }));

function post(id: string, fields: Record<string, string>) {
  return courseDetail.action({
    request: signedRequest(`http://localhost/courses/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: "lang=nl" },
      body: new URLSearchParams(fields).toString(),
    }),
    params: { id },
  } as never);
}

const lastRun = () => ({ ...alignedCourse(), studyYear: "2025-2026", phase: "Semester 2" });

describe("the course page's improvement intents (P33.1)", () => {
  it("adds, finishes and removes a point, and says so", async () => {
    const course = await courses.createCourse("imp-a", { name: "Statistiek", data: lastRun() });
    expect(
      await post(course.id, {
        intent: "add-improvement",
        text: "Casus een week eerder uitgeven",
        place: `activity:${ACT1}`,
      }),
    ).toEqual({ ok: true, intent: "improvement", message: "Verbeterpunt toegevoegd." });
    const [added] = (await courses.getCourse("imp-a", course.id))!.data.improvements!;
    expect(added).toMatchObject({
      text: "Casus een week eerder uitgeven",
      place: { kind: "activity", id: ACT1 },
      status: "open",
      source: "teacher",
      run: { studyYear: "2025-2026", phase: "Semester 2" },
    });

    expect(
      await post(course.id, { intent: "set-improvement-status", id: added!.id, status: "done" }),
    ).toEqual({ ok: true, intent: "improvement", message: "Verbeterpunt afgerond." });
    expect((await courses.getCourse("imp-a", course.id))!.data.improvements![0]!.status).toBe(
      "done",
    );

    expect(await post(course.id, { intent: "remove-improvement", id: added!.id })).toEqual({
      ok: true,
      intent: "improvement",
      message: "Verbeterpunt verwijderd.",
    });
    expect((await courses.getCourse("imp-a", course.id))!.data.improvements).toEqual([]);
  });

  it("lets an editor add a point: it is the course's content", async () => {
    const course = await courses.createCourse("imp-a", { name: "Kansen", data: lastRun() });
    expect(await members.setCourseMember("imp-a", course.id, "imp-b", "editor")).toBe(true);
    await signInAs({ id: "imp-b" });
    expect(
      await post(course.id, {
        intent: "add-improvement",
        text: "Meer voorbeelden",
        place: "course",
      }),
    ).toMatchObject({ ok: true, intent: "improvement" });
    expect((await courses.getCourse("imp-a", course.id))!.data.improvements).toHaveLength(1);
  });

  it("refuses invalid input and writes nothing; a stranger gets a 404", async () => {
    const course = await courses.createCourse("imp-a", { name: "Logica", data: lastRun() });
    expect(
      await post(course.id, { intent: "add-improvement", text: " ", place: "course" }),
    ).toEqual({
      ok: false,
      intent: "improvement",
      error: "Dit verbeterpunt kan zo niet. Schrijf een korte zin en kies een plek in de cursus.",
    });
    expect(await post(course.id, { intent: "remove-improvement", id: "gone" })).toEqual({
      ok: false,
      intent: "improvement",
      error: "Dit verbeterpunt bestaat niet meer.",
    });
    expect((await courses.getCourse("imp-a", course.id))!.data).not.toHaveProperty("improvements");
    await signInAs({ id: "imp-c" });
    const res = (await post(course.id, {
      intent: "add-improvement",
      text: "x",
      place: "course",
    }).catch((thrown: unknown) => thrown)) as Response;
    expect(res.status).toBe(404);
  });
});

describe("a copy for the new run", () => {
  it("brings the open points and leaves the finished ones", async () => {
    const course = await courses.createCourse("imp-a", {
      name: "Meetkunde",
      data: {
        ...lastRun(),
        improvements: [
          {
            id: "p-open",
            text: "Open",
            place: { kind: "course" },
            status: "open",
            source: "teacher",
          },
          {
            id: "p-done",
            text: "Klaar",
            place: { kind: "course" },
            status: "done",
            source: "teacher",
          },
        ],
      },
    });
    const copy = await courses.copyCourse("imp-a", course.id, { name: "Meetkunde 2026-2027" });
    expect(copy?.data.improvements?.map((p) => p.id)).toEqual(["p-open"]);
  });
});
