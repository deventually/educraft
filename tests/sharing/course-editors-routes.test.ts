import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";
import { alignedCourse } from "../courses/fixtures";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

const as = (id: string) => signInAs({ id });

let courses: typeof import("~/server/repositories/courses.server");
let members: typeof import("~/server/repositories/courseMembers.server");
let profiles: typeof import("~/server/repositories/profiles.server");
let courseList: typeof import("~/routes/courses._index");
let courseDetail: typeof import("~/routes/courses.$id");
let team = "";

beforeAll(async () => {
  courses = await import("~/server/repositories/courses.server");
  members = await import("~/server/repositories/courseMembers.server");
  profiles = await import("~/server/repositories/profiles.server");
  courseList = await import("~/routes/courses._index");
  courseDetail = await import("~/routes/courses.$id");
  const users = await import("~/server/repositories/users.server");
  const teams = await import("~/server/repositories/teams.server");
  for (const [id, name] of [
    ["ed-a", "Anna"],
    ["ed-b", "Bram"],
    ["ed-c", "Cas"],
  ] as const)
    await users.createUser({ id, name, passwordHash: "x", role: "teacher" });
  team = (await teams.createTeam("Informatica")).id;
  await teams.addMember(team, "ed-a");
  await teams.addMember(team, "ed-b");
});

beforeEach(() => as("ed-a"));

function post(path: string, fields: Record<string, string>): Request {
  return signedRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: "lang=nl" },
    body: new URLSearchParams(fields).toString(),
  });
}
const get = (path: string) => signedRequest(`http://localhost${path}`);

const act = (id: string, fields: Record<string, string>) =>
  courseDetail.action({ request: post(`/courses/${id}`, fields), params: { id } } as never);

type Loaded = {
  editors: {
    isOwner: boolean;
    ownerName: string;
    editors: { userId: string; name: string }[];
    candidates: { userId: string; name: string }[];
  };
  sharing: { teams: unknown[] };
};
const load = async (id: string) =>
  (await courseDetail.loader({
    request: get(`/courses/${id}`),
    params: { id },
  } as never)) as Loaded;

describe("working on a course together (BESLUIT-2026-11-10-3)", () => {
  it("lets the owner add and remove a team-mate as editor from the course page", async () => {
    const course = await courses.createCourse("ed-a", { name: "Databases", data: alignedCourse() });
    expect((await load(course.id)).editors).toEqual({
      isOwner: true,
      ownerName: "Anna",
      editors: [],
      candidates: [{ userId: "ed-b", name: "Bram" }],
    });

    expect(await act(course.id, { intent: "add-editor", userId: "ed-b" })).toMatchObject({
      ok: true,
      intent: "add-editor",
    });
    expect(await members.listCourseEditors("ed-a", course.id)).toEqual([
      { userId: "ed-b", name: "Bram" },
    ]);
    expect(await act(course.id, { intent: "add-editor", userId: "ed-c" })).toMatchObject({
      ok: false,
      intent: "add-editor",
    });

    expect(await act(course.id, { intent: "remove-editor", userId: "ed-b" })).toMatchObject({
      ok: true,
      intent: "remove-editor",
    });
    expect(await members.listCourseEditors("ed-a", course.id)).toEqual([]);
  });

  it("opens the course for an editor, who edits it but cannot share, choose editors or delete", async () => {
    const course = await courses.createCourse("ed-a", {
      name: "Algoritmen",
      data: alignedCourse(),
    });
    await members.addCourseEditor("ed-a", course.id, "ed-b");
    await as("ed-b");

    const loaded = await load(course.id);
    expect(loaded.editors).toMatchObject({ isOwner: false, ownerName: "Anna", candidates: [] });
    expect(loaded.sharing.teams).toEqual([]);

    expect(await act(course.id, { intent: "settings", name: "Algoritmen 2" })).toMatchObject({
      ok: true,
    });
    expect((await courses.getCourse("ed-a", course.id))?.name).toBe("Algoritmen 2");

    expect(await act(course.id, { intent: "share", teamId: team })).toMatchObject({ ok: false });
    expect(await act(course.id, { intent: "add-editor", userId: "ed-a" })).toMatchObject({
      ok: false,
    });
    const del = await courseList.action({
      request: post("/courses", { intent: "delete", id: course.id }),
      params: {},
    } as never);
    expect(del).toMatchObject({ ok: false });
    expect(await courses.getCourse("ed-a", course.id)).not.toBeNull();
  });

  it("keeps the owner's context profile when an editor saves the settings", async () => {
    const profile = await profiles.createProfile("ed-a", { name: "HBO-ICT" });
    const course = await courses.createCourse("ed-a", {
      name: "Netwerken",
      contextProfileId: profile.id,
      data: alignedCourse(),
    });
    await members.addCourseEditor("ed-a", course.id, "ed-b");
    await as("ed-b");
    expect(
      await act(course.id, { intent: "settings", name: "Netwerken", contextProfileId: "" }),
    ).toMatchObject({ ok: true });
    expect((await courses.getCourse("ed-a", course.id))?.contextProfileId).toBe(profile.id);
  });

  it("lets an editor stop working on a course", async () => {
    const course = await courses.createCourse("ed-a", { name: "Security", data: alignedCourse() });
    await members.addCourseEditor("ed-a", course.id, "ed-b");
    await as("ed-b");
    const r = await act(course.id, { intent: "leave-course" }).catch((e: unknown) => e);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/courses");
    expect(await courses.getCourse("ed-b", course.id)).toBeNull();
  });

  it("lists an editor's courses with the owner's name, not again under 'Van mijn team'", async () => {
    const course = await courses.createCourse("ed-a", { name: "Webdev", data: alignedCourse() });
    await members.addCourseEditor("ed-a", course.id, "ed-b");
    const shares = await import("~/server/repositories/shares.server");
    await shares.shareItem("ed-a", "course", course.id, team);
    await as("ed-b");
    const loaded = (await courseList.loader({ request: get("/courses"), params: {} } as never)) as {
      courses: { id: string; ownerName: string | null }[];
      shared: { id: string }[];
    };
    expect(loaded.courses.find((c) => c.id === course.id)).toMatchObject({ ownerName: "Anna" });
    expect(loaded.shared.map((s) => s.id)).not.toContain(course.id);
  });
});
