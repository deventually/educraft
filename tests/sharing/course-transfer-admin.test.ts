import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";
import { alignedCourse } from "../courses/fixtures";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let users: typeof import("~/server/repositories/users.server");
let settings: typeof import("~/server/repositories/settings.server");
let courses: typeof import("~/server/repositories/courses.server");
let members: typeof import("~/server/repositories/courseMembers.server");
let audit: typeof import("~/server/repositories/auditLog.server");
let person: typeof import("~/routes/admin.users.$id");

beforeAll(async () => {
  users = await import("~/server/repositories/users.server");
  settings = await import("~/server/repositories/settings.server");
  courses = await import("~/server/repositories/courses.server");
  members = await import("~/server/repositories/courseMembers.server");
  audit = await import("~/server/repositories/auditLog.server");
  person = await import("~/routes/admin.users.$id");
});

let n = 0;
async function mk(role: "teacher" | "admin" = "teacher") {
  n++;
  return users.createUser({ name: `P${n}`, passwordHash: "x", role });
}

function act(id: string, fields: Record<string, string>) {
  const request = signedRequest("http://localhost/x", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: "lang=nl" },
    body: new URLSearchParams(fields).toString(),
  });
  return person.action({ request, params: { id }, context: {} } as never) as Promise<
    Record<string, unknown>
  >;
}
type Loaded = {
  courses: {
    list: { id: string; name: string; members: { userId: string; role: string }[] }[];
    colleagues: { userId: string; name: string }[];
    lost: number;
  } | null;
};
const load = async (id: string) =>
  (await person.loader({
    request: signedRequest("http://localhost/x"),
    params: { id },
    context: {},
  } as never)) as Loaded;

let owner: Awaited<ReturnType<typeof mk>>;
beforeEach(async () => {
  owner ??= await mk("admin");
  await settings.setOwnerUserId(owner.id);
  await signInAs({ id: owner.id });
});

const newCourse = (userId: string, name: string) =>
  courses.createCourse(userId, { name, data: alignedCourse() });

describe("an admin hands a teacher's courses over (BESLUIT-2026-11-10-5)", () => {
  it("shows the teacher's courses, the colleagues to hand them to and what deleting loses", async () => {
    const t = await mk();
    const other = await mk();
    const gone = await mk();
    await users.setUserDisabled(gone.id, true);
    const course = await newCourse(t.id, "Biologie");
    const loaded = await load(t.id);
    expect(loaded.courses?.list).toEqual([{ id: course.id, name: "Biologie", members: [] }]);
    const ids = loaded.courses?.colleagues.map((c) => c.userId);
    expect(ids).toContain(other.id);
    expect(ids).not.toContain(t.id);
    expect(ids).not.toContain(gone.id);
    expect(loaded.courses?.lost).toBe(1);
  });

  it("hands one course of a disabled teacher to a colleague, and logs it", async () => {
    const t = await mk();
    const other = await mk();
    const course = await newCourse(t.id, "Scheikunde");
    await users.setUserDisabled(t.id, true);
    expect(
      await act(t.id, { intent: "transferCourse", courseId: course.id, toId: other.id }),
    ).toEqual({ coursesTransferred: 1 });
    expect((await courses.getCourse(other.id, course.id))?.ownerId).toBe(other.id);
    expect((await audit.listAdminActions())[0]).toMatchObject({
      action: "coursesTransferred",
      targetUserId: t.id,
      detail: { count: 1 },
    });
  });

  it("hands all courses over at once, keeping the teacher on as editor when asked", async () => {
    const t = await mk();
    const other = await mk();
    const a = await newCourse(t.id, "A");
    await newCourse(t.id, "B");
    expect(
      await act(t.id, { intent: "transferAllCourses", toId: other.id, keepAsEditor: "on" }),
    ).toEqual({ coursesTransferred: 2 });
    expect((await courses.getCourse(t.id, a.id))?.role).toBe("editor");
  });

  it("adds and removes a course member, and refuses a course of someone else", async () => {
    const t = await mk();
    const other = await mk();
    const course = await newCourse(t.id, "Natuurkunde");
    expect(
      await act(t.id, {
        intent: "courseMember",
        courseId: course.id,
        userId: other.id,
        role: "co-owner",
      }),
    ).toEqual({ courseMemberSaved: true });
    expect((await members.listCourseMembers(t.id, course.id)).map((m) => m.role)).toEqual([
      "co-owner",
    ]);
    expect(
      await act(other.id, {
        intent: "courseMember",
        courseId: course.id,
        userId: owner.id,
        role: "editor",
      }),
    ).toEqual({ error: "courseRefused" });
    expect(
      await act(t.id, { intent: "removeCourseMember", courseId: course.id, userId: other.id }),
    ).toEqual({ courseMemberSaved: true });
    expect(await members.listCourseMembers(t.id, course.id)).toEqual([]);
  });

  it("refuses a teacher a hand-over on their own page as admin only", async () => {
    const t = await mk();
    const course = await newCourse(t.id, "Wiskunde");
    await signInAs({ id: t.id });
    await expect(
      act(t.id, { intent: "transferCourse", courseId: course.id, toId: owner.id }),
    ).rejects.toBeInstanceOf(Response);
  });
});
