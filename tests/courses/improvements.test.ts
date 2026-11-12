import { describe, expect, it } from "vitest";
import { ACT1, alignedCourse, LO1, TEST1 } from "./fixtures";
import { applyImprovementIntent, improvementPlace } from "~/lib/courses/improvements";
import { forNewRun } from "~/lib/courses/newRun";
import { COURSE_LIMITS, CourseDataSchema } from "~/lib/courses/schema";
import type { CourseData, Improvement } from "~/lib/courses/types";

const point = (over: Partial<Improvement> = {}): Improvement => ({
  id: crypto.randomUUID(),
  text: "Geef de casus een week eerder uit.",
  place: { kind: "activity", id: ACT1 },
  status: "open",
  source: "teacher",
  run: { studyYear: "2025-2026", phase: "Semester 1" },
  ...over,
});

const withPoints = (...improvements: Improvement[]): CourseData => ({
  ...alignedCourse(),
  studyYear: "2025-2026",
  phase: "Semester 1",
  improvements,
});

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

/** The new course data of a successful intent; fails the test otherwise. */
function applied(d: CourseData, fd: FormData): CourseData {
  const r = applyImprovementIntent(d, fd);
  if (!r?.ok) throw new Error(`Expected success, got ${JSON.stringify(r)}`);
  return r.data;
}

describe("improvements in the course data (P33.1)", () => {
  it("are optional, and valid on their places", () => {
    expect(CourseDataSchema.safeParse(alignedCourse()).success).toBe(true);
    const data = withPoints(
      point(),
      point({ place: { kind: "course" }, source: "evaluation", status: "done" }),
      point({ place: { kind: "outcome", id: LO1 }, run: undefined }),
    );
    expect(CourseDataSchema.parse(data).improvements).toHaveLength(3);
  });

  it("are capped, and refuse an unknown status, source or place kind", () => {
    const many = Array.from({ length: COURSE_LIMITS.improvements + 1 }, () => point());
    expect(CourseDataSchema.safeParse(withPoints(...many)).success).toBe(false);
    for (const bad of [
      { status: "later" },
      { source: "ai" },
      { place: { kind: "lesson", id: ACT1 } },
      { place: { kind: "activity" } },
      { text: "" },
    ])
      expect(
        CourseDataSchema.safeParse(withPoints(point(bad as Partial<Improvement>))).success,
      ).toBe(false);
  });
});

describe("improvementPlace", () => {
  it("keeps a place that exists and makes an unknown one the whole course", () => {
    const d = alignedCourse();
    expect(improvementPlace(d, { kind: "assessment", id: TEST1 })).toEqual({
      kind: "assessment",
      id: TEST1,
    });
    expect(improvementPlace(d, { kind: "activity", id: "gone" })).toEqual({ kind: "course" });
    // An id of the wrong kind does not count either.
    expect(improvementPlace(d, { kind: "outcome", id: ACT1 })).toEqual({ kind: "course" });
  });
});

describe("forNewRun carries the open improvements", () => {
  it("takes the open points, leaves the finished ones, and re-places an orphan on the course", () => {
    const open = point();
    const orphan = point({ place: { kind: "assessment", id: "removed-test" } });
    const done = point({ status: "done" });
    const data = forNewRun(withPoints(open, done, orphan), { studyYear: "2026-2027" });
    expect(data.improvements).toEqual([open, { ...orphan, place: { kind: "course" } }]);
  });

  it("leaves the field out when nothing is open", () => {
    const data = forNewRun(withPoints(point({ status: "done" })), {});
    expect(data).not.toHaveProperty("improvements");
  });
});

describe("applyImprovementIntent", () => {
  it("adds the teacher's own point with its place and the course's run", () => {
    const data = applied(
      withPoints(),
      form({ intent: "add-improvement", text: "  Meer oefentijd  ", place: `activity:${ACT1}` }),
    );
    expect(data.improvements).toEqual([
      {
        id: expect.any(String),
        text: "Meer oefentijd",
        place: { kind: "activity", id: ACT1 },
        status: "open",
        source: "teacher",
        run: { studyYear: "2025-2026", phase: "Semester 1" },
      },
    ]);
  });

  it("adds a point on the whole course, without a run when the course has none", () => {
    const data = applied(
      alignedCourse(),
      form({ intent: "add-improvement", text: "Rooster eerder delen", place: "course" }),
    );
    expect(data.improvements?.[0]).toEqual({
      id: expect.any(String),
      text: "Rooster eerder delen",
      place: { kind: "course" },
      status: "open",
      source: "teacher",
    });
  });

  it("adds a point accepted from the evaluation as such, and refuses another source", () => {
    const data = applied(
      withPoints(),
      form({
        intent: "add-improvement",
        text: "Meer oefentijd",
        place: "course",
        source: "evaluation",
      }),
    );
    expect(data.improvements?.[0]?.source).toBe("evaluation");
    expect(
      applyImprovementIntent(
        withPoints(),
        form({ intent: "add-improvement", text: "Ok", place: "course", source: "ai" }),
      )?.ok,
    ).toBe(false);
  });

  it("marks a point done and open again, and removes one", () => {
    const a = point();
    const b = point();
    const done = applied(
      withPoints(a, b),
      form({ intent: "set-improvement-status", id: a.id, status: "done" }),
    );
    expect(done.improvements?.map((p) => p.status)).toEqual(["done", "open"]);
    const removed = applied(withPoints(a, b), form({ intent: "remove-improvement", id: a.id }));
    expect(removed.improvements).toEqual([b]);
  });

  it("refuses invalid input and unknown places or points", () => {
    const d = withPoints(point());
    const cases: Record<string, string>[] = [
      { intent: "add-improvement", text: "", place: "course" },
      { intent: "add-improvement", text: "x".repeat(COURSE_LIMITS.text + 1), place: "course" },
      { intent: "add-improvement", text: "Ok", place: "lesson:act-1" },
      { intent: "add-improvement", text: "Ok", place: "activity:gone" },
      { intent: "set-improvement-status", id: "gone", status: "done" },
      { intent: "set-improvement-status", id: d.improvements![0]!.id, status: "later" },
      { intent: "remove-improvement", id: "gone" },
    ];
    for (const fields of cases) expect(applyImprovementIntent(d, form(fields))?.ok).toBe(false);
  });

  it("refuses a point beyond the cap", () => {
    const full = withPoints(
      ...Array.from({ length: COURSE_LIMITS.improvements }, () => point({ status: "done" })),
    );
    expect(
      applyImprovementIntent(
        full,
        form({ intent: "add-improvement", text: "Nog één", place: "course" }),
      ),
    ).toEqual({ ok: false, error: "full" });
  });

  it("is null for any other intent", () => {
    expect(applyImprovementIntent(alignedCourse(), form({ intent: "add-outcome" }))).toBeNull();
  });
});
