import { describe, expect, it } from "vitest";
import type { CourseData } from "~/lib/courses/types";
import {
  type CourseWeek,
  GRADE_WEEKS,
  MAX_ROWS,
  nextWeek,
  teacherWeek,
  type WeekCourse,
} from "~/lib/week/teacherWeek";

// A course that starts on Monday 2 November 2026: week 1 = 2 Nov, week 2 = 9 Nov, …
function course(over: Partial<WeekCourse> = {}, data: Partial<CourseData> = {}): WeekCourse {
  return {
    id: "c1",
    name: "Databases",
    data: {
      startDate: "2026-11-02",
      outcomes: [{ id: "lo1", text: "Je ontwerpt een datamodel." }],
      activities: [
        { id: "a1", title: "Les 1", week: 1, kind: "lesson", outcomeIds: ["lo1"] },
        { id: "a2", title: "Les 2", week: 2, kind: "lesson", outcomeIds: ["lo1"] },
        { id: "a3", title: "Les 3", week: 3, kind: "lesson", outcomeIds: ["lo1"] },
        { id: "a4", title: "Les 4", week: 4, kind: "lesson", outcomeIds: ["lo1"] },
      ],
      assessments: [
        {
          id: "t1",
          title: "Oefentoets",
          week: 1,
          kind: "formative",
          coverage: [{ outcomeId: "lo1" }],
        },
        {
          id: "t2",
          title: "Tentamen",
          week: 4,
          kind: "summative",
          weight: 100,
          coverage: [{ outcomeId: "lo1" }],
        },
      ],
      ...data,
    },
    ...over,
  };
}

const titles = (rows: { title: string }[]) => rows.map((r) => r.title);
const running = (w: CourseWeek) => {
  if (w.status !== "week") throw new Error(`expected a running week, got ${w.status}`);
  return w;
};

describe("teacherWeek (P22.2)", () => {
  it("gives this week's activities and assessments", () => {
    const week = teacherWeek({
      courses: [course()],
      links: [],
      breakWeeks: [],
      today: "2026-11-04",
    });
    expect(week.monday).toBe("2026-11-02");
    expect(week.isoWeek).toBe(45);
    const c = running(week.courses[0]);
    expect(c).toMatchObject({ courseId: "c1", courseName: "Databases", week: 1 });
    expect(titles(c.thisWeek.rows)).toEqual(["Les 1", "Oefentoets"]);
    expect(c.thisWeek.rows[0]).toMatchObject({ itemId: "a1", kind: "activity", week: 1 });
    expect(c.thisWeek.rows[1]).toMatchObject({ itemId: "t1", kind: "assessment", week: 1 });
  });

  it("lists a lesson without linked work under prepare, and drops it once work is linked", () => {
    const input = { courses: [course()], breakWeeks: [], today: "2026-11-04" };
    const before = running(teacherWeek({ ...input, links: [] }).courses[0]);
    // This week and next week.
    expect(titles(before.prepare.rows)).toEqual(["Les 1", "Oefentoets", "Les 2"]);
    const after = running(
      teacherWeek({ ...input, links: [{ courseId: "c1", itemId: "a2" }] }).courses[0],
    );
    expect(titles(after.prepare.rows)).toEqual(["Les 1", "Oefentoets"]);
    // A link to the course as a whole, or to another course's item, prepares nothing.
    const other = running(
      teacherWeek({
        ...input,
        links: [
          { courseId: "c1", itemId: null },
          { courseId: "c2", itemId: "a1" },
        ],
      }).courses[0],
    );
    expect(titles(other.prepare.rows)).toEqual(["Les 1", "Oefentoets", "Les 2"]);
  });

  it("lists the assessments of the two previous weeks under grade", () => {
    // Week 2: the quiz of week 1 needs grading.
    const w2 = running(
      teacherWeek({ courses: [course()], links: [], breakWeeks: [], today: "2026-11-09" })
        .courses[0],
    );
    expect(titles(w2.grade.rows)).toEqual(["Oefentoets"]);
    // Week 4 looks back to weeks 2 and 3 only.
    const w4 = running(
      teacherWeek({ courses: [course()], links: [], breakWeeks: [], today: "2026-11-23" })
        .courses[0],
    );
    expect(w4.grade.rows).toEqual([]);
    expect(GRADE_WEEKS).toBe(2);
  });

  it("keeps a course in the week while its last assessment is being graded", () => {
    // The exam is in week 4 (23 Nov); weeks 5 and 6 still show it under grade.
    const w6 = running(
      teacherWeek({ courses: [course()], links: [], breakWeeks: [], today: "2026-12-07" })
        .courses[0],
    );
    expect(w6.week).toBe(6);
    expect(w6.thisWeek.rows).toEqual([]);
    expect(titles(w6.grade.rows)).toEqual(["Tentamen"]);
    // Week 7 is over.
    expect(
      teacherWeek({ courses: [course()], links: [], breakWeeks: [], today: "2026-12-14" }).courses,
    ).toEqual([]);
  });

  it("gives one break row in a break week", () => {
    const week = teacherWeek({
      courses: [course()],
      links: [],
      breakWeeks: ["2026-11-09"],
      today: "2026-11-11",
    });
    expect(week.courses).toEqual([{ courseId: "c1", courseName: "Databases", status: "break" }]);
  });

  it("drops a course that has not started yet", () => {
    expect(
      teacherWeek({ courses: [course()], links: [], breakWeeks: [], today: "2026-11-01" }).courses,
    ).toEqual([]);
  });

  it("puts a course without a start date in its own list", () => {
    const week = teacherWeek({
      courses: [course({ id: "c2", name: "Zonder" }, { startDate: undefined })],
      links: [],
      breakWeeks: [],
      today: "2026-11-04",
    });
    expect(week.courses).toEqual([]);
    expect(week.undated).toEqual([{ courseId: "c2", courseName: "Zonder" }]);
  });

  it("sorts two courses by name and keeps their items apart", () => {
    const week = teacherWeek({
      courses: [course({ id: "z", name: "Webtechniek" }), course({ id: "a", name: "Algoritmen" })],
      links: [{ courseId: "z", itemId: "a1" }],
      breakWeeks: [],
      today: "2026-11-04",
    });
    expect(week.courses.map((c) => c.courseName)).toEqual(["Algoritmen", "Webtechniek"]);
    expect(titles(running(week.courses[0]).prepare.rows)).toContain("Les 1");
    expect(titles(running(week.courses[1]).prepare.rows)).not.toContain("Les 1");
  });

  it("counts the open alignment findings, and the role-agent findings only when given", () => {
    const misaligned = course(
      {},
      {
        outcomes: [
          { id: "lo1", text: "x" },
          { id: "lo2", text: "y" },
        ],
      },
    );
    const input = { courses: [misaligned], links: [], breakWeeks: [], today: "2026-11-04" };
    const c = running(teacherWeek(input).courses[0]);
    expect(c.findings).toBeGreaterThan(0);
    expect(c).not.toHaveProperty("agentFindings");
    const withAgents = running(teacherWeek({ ...input, agentFindings: { c1: 3 } }).courses[0]);
    expect(withAgents.agentFindings).toBe(3);
  });

  it("caps each list and says how many more there are", () => {
    const many = Array.from({ length: MAX_ROWS + 3 }, (_, i) => ({
      id: `x${i}`,
      title: `Les ${i}`,
      week: 1,
      kind: "lesson" as const,
      outcomeIds: ["lo1"],
    }));
    const c = running(
      teacherWeek({
        courses: [course({}, { activities: many })],
        links: [],
        breakWeeks: [],
        today: "2026-11-02",
      }).courses[0],
    );
    expect(c.thisWeek.rows).toHaveLength(MAX_ROWS);
    expect(c.thisWeek.more).toBe(4); // 13 lessons + the quiz, 10 shown
  });
});

describe("nextWeek (P22.2)", () => {
  it("is the same week a week later", () => {
    const week = nextWeek({ courses: [course()], links: [], breakWeeks: [], today: "2026-11-06" });
    expect(week.monday).toBe("2026-11-09");
    expect(titles(running(week.courses[0]).thisWeek.rows)).toEqual(["Les 2"]);
  });

  it("looks across a break", () => {
    // Friday 6 Nov; the week of 9 Nov is a break, so next week is a break row.
    const input = {
      courses: [course()],
      links: [],
      breakWeeks: ["2026-11-09"],
      today: "2026-11-06",
    };
    expect(nextWeek(input).courses[0].status).toBe("break");
    // The week after the break is course week 2.
    const after = teacherWeek({ ...input, today: "2026-11-16" });
    expect(running(after.courses[0]).week).toBe(2);
  });
});
