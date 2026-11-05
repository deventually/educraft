import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { alignedCourse } from "../courses/fixtures";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

const { currentUser } = vi.hoisted(() => ({
  currentUser: { value: { id: "teacher-a", name: "A", email: null, role: "teacher" } as never },
}));
vi.mock("~/server/auth.server", () => ({
  requireUser: vi.fn(async () => currentUser.value),
  requireRole: vi.fn(async () => currentUser.value),
}));

let repo: typeof import("~/server/repositories/courses.server");
let route: typeof import("~/routes/courses.$id.calendar");

beforeAll(async () => {
  repo = await import("~/server/repositories/courses.server");
  route = await import("~/routes/courses.$id.calendar");
});

beforeEach(() => {
  currentUser.value = { id: "teacher-a", name: "A", email: null, role: "teacher" } as never;
});

const get = (id: string) =>
  route.loader({
    request: new Request(`http://localhost/courses/${id}/calendar.ics`),
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
    currentUser.value = { id: "teacher-b", name: "B", email: null, role: "teacher" } as never;
    expect(await status(get(c.id))).toBe(404);
  });

  it("is a 404 without a start date", async () => {
    const c = await repo.createCourse("teacher-a", { name: "Geen datum", data: alignedCourse() });
    expect(await status(get(c.id))).toBe(404);
  });
});
