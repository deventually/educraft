import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signIn, withCookie } from "../helpers/session";
import { alignedCourse } from "../courses/fixtures";

let cookie = "";
const as = async (id: string) => {
  cookie = await signIn({ id });
};

let repo: typeof import("~/server/repositories/courses.server");
let route: typeof import("~/routes/courses.$id.calendar");

beforeAll(async () => {
  repo = await import("~/server/repositories/courses.server");
  route = await import("~/routes/courses.$id.calendar");
});

beforeEach(() => as("teacher-a"));

const get = (id: string) =>
  route.loader({
    request: withCookie(new Request(`http://localhost/courses/${id}/calendar.ics`), cookie),
    params: { id },
    context: {},
  } as never) as Promise<Response>;

async function status(p: Promise<unknown>): Promise<number | undefined> {
  try {
    const r = await p;
    return r instanceof Response ? r.status : undefined;
  } catch (e) {
    return e instanceof Response ? e.status : -1;
  }
}

describe("/courses/:id/calendar.ics (P22.4)", () => {
  it("gives the owner the calendar as a download", async () => {
    const c = await repo.createCourse("teacher-a", {
      name: "Databases jaar 1",
      data: { ...alignedCourse(), startDate: "2026-11-02" },
    });
    const res = await get(c.id);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/calendar; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="databases-jaar-1\.ics"/,
    );
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain(`UID:${c.id}-`);
  });

  it("is a 404 for someone else's course", async () => {
    const c = await repo.createCourse("teacher-a", {
      name: "Van A",
      data: { ...alignedCourse(), startDate: "2026-11-02" },
    });
    await as("teacher-b");
    expect(await status(get(c.id))).toBe(404);
  });

  it("is a 404 without a start date", async () => {
    const c = await repo.createCourse("teacher-a", { name: "Geen datum", data: alignedCourse() });
    expect(await status(get(c.id))).toBe(404);
  });
});
