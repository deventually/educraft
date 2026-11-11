import { describe, expect, it } from "vitest";
import {
  applyLessons,
  applyLessonsBrief,
  buildLessonsDesignMessage,
  canDesignLessons,
  DESIGN_LESSONS_LIMITS,
  lessonsPerWeek,
  parseLessonsBrief,
  parseLessonsDesign,
  parseLessonsSelection,
} from "~/lib/courses/designLessons";
import { emptyCourseData } from "~/lib/courses/schema";
import type { CourseData } from "~/lib/courses/types";

/** A course after step 2: three outcomes, a test programme, no lessons yet. */
function planned(extra: Partial<CourseData> = {}): CourseData {
  return {
    ...emptyCourseData(),
    ec: 5,
    schedule: { weeks: 8, sessionsPerWeek: 2 },
    outcomes: [
      { id: "lo-a", text: "De student ontwerpt een datamodel.", bloom: "create" },
      { id: "lo-b", text: "De student schrijft SQL-queries.", bloom: "apply" },
      { id: "lo-c", text: "De student legt normaliseren uit.", bloom: "understand" },
    ],
    assessments: [
      {
        id: "t-1",
        title: "Oefentoets SQL",
        kind: "formative",
        week: 4,
        coverage: [{ outcomeId: "lo-b" }],
      },
      {
        id: "t-2",
        title: "Beroepsproduct",
        kind: "summative",
        week: 8,
        weight: 100,
        coverage: [{ outcomeId: "lo-a" }, { outcomeId: "lo-b" }, { outcomeId: "lo-c" }],
      },
    ],
    ...extra,
  };
}

const lesson = (title: string, week: number, refs: number[], more: object = {}) => ({
  title,
  week,
  kind: "lesson",
  goal: `Na ${title} kan de student iets.`,
  outcomeRefs: refs,
  ...more,
});

const answer = (lessons: object[], notes: string | null = "Week 8 is de toetsweek.") =>
  JSON.stringify({ lessons, notes });

const fd = (fields: [string, string][]) => {
  const f = new FormData();
  for (const [k, v] of fields) f.append(k, v);
  return f;
};

describe("canDesignLessons", () => {
  it("follows step 2: outcomes and tests, and no lessons yet", () => {
    expect(canDesignLessons(planned())).toBe(true);
    expect(canDesignLessons(emptyCourseData())).toBe(false);
    expect(canDesignLessons(planned({ assessments: [] }))).toBe(false);
    expect(
      canDesignLessons(
        planned({ activities: [{ id: "x", title: "Les", kind: "lesson", outcomeIds: [] }] }),
      ),
    ).toBe(false);
  });
});

describe("parseLessonsBrief and applyLessonsBrief", () => {
  it("reads the wishes and, where the schedule is empty, the weeks and sessions", () => {
    expect(parseLessonsBrief(fd([["wishes", "  Week 4 is projectweek.  "]]))).toEqual({
      wishes: "Week 4 is projectweek.",
    });
    expect(
      parseLessonsBrief(
        fd([
          ["weeks", "10"],
          ["sessionsPerWeek", "3"],
        ]),
      ),
    ).toEqual({ weeks: 10, sessionsPerWeek: 3 });
    expect(parseLessonsBrief(fd([]))).toEqual({});
  });

  it("refuses wishes that are too long and numbers out of range", () => {
    expect(parseLessonsBrief(fd([["wishes", "x".repeat(DESIGN_LESSONS_LIMITS.wishes + 1)]]))).toBe(
      null,
    );
    expect(parseLessonsBrief(fd([["weeks", "0"]]))).toBe(null);
    expect(parseLessonsBrief(fd([["sessionsPerWeek", "2.5"]]))).toBe(null);
  });

  it("keeps the weeks and sessions in the schedule only where it was empty", () => {
    const empty = planned({ schedule: undefined });
    expect(applyLessonsBrief(empty, { weeks: 10, sessionsPerWeek: 3 }).schedule).toEqual({
      weeks: 10,
      sessionsPerWeek: 3,
    });
    expect(applyLessonsBrief(planned(), { weeks: 10, sessionsPerWeek: 3 }).schedule).toEqual({
      weeks: 8,
      sessionsPerWeek: 2,
    });
  });
});

describe("lessonsPerWeek", () => {
  it("is the sessions per week, without disciplines", () => {
    expect(lessonsPerWeek(planned())).toEqual({ total: 2, perDiscipline: [] });
    expect(lessonsPerWeek(planned({ schedule: { weeks: 8 } }))).toEqual({
      total: undefined,
      perDiscipline: [],
    });
  });

  it("splits by the hours of each discipline: at least one lesson, a session at most per lesson", () => {
    const d = planned({
      schedule: { weeks: 10, sessionsPerWeek: 2, sessionMinutes: 240 },
      disciplines: [
        { id: "d-web", name: "Webtech", hoursPerWeek: 8 },
        { id: "d-hw", name: "Hardware", hoursPerWeek: 2 },
        { id: "d-pv", name: "Professionele vaardigheden" },
      ],
    });
    expect(lessonsPerWeek(d)).toEqual({ total: 4, perDiscipline: [2, 1, 1] });
  });

  it("never asks for more lessons than the proposal can hold", () => {
    const d = planned({ schedule: { weeks: 20, sessionsPerWeek: 10 } });
    const { total } = lessonsPerWeek(d);
    expect((total ?? 0) * 20).toBeLessThanOrEqual(DESIGN_LESSONS_LIMITS.lessons);
    expect(total).toBe(3);
  });
});

describe("buildLessonsDesignMessage", () => {
  it("gives the outcomes, the tests with their week and outcomes, and the rhythm", () => {
    const m = buildLessonsDesignMessage({
      name: "Databases",
      data: planned(),
      brief: { wishes: "Week 4 is projectweek." },
      context: "Context van de opleiding (hbo)",
    });
    expect(m).toContain("<course>Databases</course>");
    expect(m).toContain("<weeks>8</weeks>");
    expect(m).toContain("<lessonsPerWeek>2</lessonsPerWeek>");
    expect(m).toContain("1. De student ontwerpt een datamodel. [create]");
    expect(m).toContain("- Oefentoets SQL [formative, week 4]: 2");
    expect(m).toContain("- Beroepsproduct [summative, week 8]: 1, 2, 3");
    expect(m).toContain("Week 4 is projectweek.");
    expect(m).toContain("Context van de opleiding (hbo)");
    expect(m).not.toContain("<disciplines>");
  });

  it("names the disciplines with their lessons per week, never their teachers", () => {
    const m = buildLessonsDesignMessage({
      name: "Pixel Perfect",
      data: planned({
        schedule: { weeks: 10, sessionsPerWeek: 2, sessionMinutes: 240 },
        disciplines: [
          { id: "d-web", name: "Webtech", teacher: "J. Jansen", hoursPerWeek: 8 },
          { id: "d-hw", name: "Hardware" },
        ],
      }),
      brief: {},
      context: "",
    });
    expect(m).toContain("1. Webtech: 2");
    expect(m).toContain("2. Hardware: 1");
    expect(m).toContain("<lessonsPerWeek>3</lessonsPerWeek>");
    expect(m).toContain("<sessionMinutes>240</sessionMinutes>");
    expect(m).not.toContain("Jansen");
  });

  it("takes the weeks from the latest test when the schedule has none", () => {
    const m = buildLessonsDesignMessage({
      name: "X",
      data: planned({ schedule: undefined }),
      brief: {},
      context: "",
    });
    expect(m).toContain("<weeks>8</weeks>");
    expect(m).not.toContain("<lessonsPerWeek>");
  });
});

describe("parseLessonsDesign", () => {
  it("turns the answer into lessons over the course's own outcomes, sorted by week", () => {
    const r = parseLessonsDesign(
      answer([
        lesson("Joins oefenen", 3, [2]),
        lesson("Kennismaken met SQL", 1, [2, 3]),
        lesson("Datamodel ontwerpen", 2, [1], { kind: "assignment" }),
      ]),
      planned(),
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.clipped).toBe(false);
    expect(r.proposal.lessons.map((l) => [l.key, l.title, l.week, l.kind])).toEqual([
      ["l1", "Kennismaken met SQL", 1, "lesson"],
      ["l2", "Datamodel ontwerpen", 2, "assignment"],
      ["l3", "Joins oefenen", 3, "lesson"],
    ]);
    expect(r.proposal.lessons[0]).toMatchObject({
      goal: "Na Kennismaken met SQL kan de student iets.",
      outcomeIds: ["lo-b", "lo-c"],
    });
    expect(r.proposal.outcomes).toEqual([
      { id: "lo-a", text: "De student ontwerpt een datamodel." },
      { id: "lo-b", text: "De student schrijft SQL-queries." },
      { id: "lo-c", text: "De student legt normaliseren uit." },
    ]);
    expect(r.proposal.notes).toBe("Week 8 is de toetsweek.");
    expect(r.proposal.untaught).toEqual([]);
    expect(r.proposal.late).toEqual([]);
  });

  it("drops what is not the course's: unknown outcomes, weeks and disciplines, odd kinds", () => {
    const r = parseLessonsDesign(
      answer([
        lesson("Les", 12, [0, 2, 9], { kind: "lecture", discipline: 5 }),
        lesson("Webles", 2, [1], { discipline: 1 }),
      ]),
      planned({ disciplines: [{ id: "d-web", name: "Webtech" }] }),
    );
    if (!r.ok) throw new Error(r.error);
    const [web, les] = r.proposal.lessons;
    expect(web).toMatchObject({ title: "Webles", week: 2, disciplineId: "d-web" });
    expect(les).toMatchObject({ title: "Les", kind: "lesson", outcomeIds: ["lo-b"] });
    expect(les?.week).toBeUndefined();
    expect(les?.disciplineId).toBeUndefined();
    expect(r.proposal.disciplines).toEqual([{ id: "d-web", name: "Webtech" }]);
  });

  it("drops empty and duplicate lessons in a week, and clips to the limits", () => {
    const many = Array.from({ length: DESIGN_LESSONS_LIMITS.lessons + 5 }, (_, i) =>
      lesson(`Les ${i + 1}`, 1 + (i % 8), [1]),
    );
    const r = parseLessonsDesign(
      answer([lesson(" ", 1, [1]), lesson("Les 1", 1, [1]), ...many]),
      planned(),
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.proposal.lessons).toHaveLength(DESIGN_LESSONS_LIMITS.lessons);
    expect(r.proposal.lessons.filter((l) => l.title === "Les 1")).toHaveLength(1);
    expect(r.clipped).toBe(true);
    const long = parseLessonsDesign(
      answer([lesson("x".repeat(300), 1, [1], { goal: "y".repeat(400) })]),
      planned(),
    );
    if (!long.ok) throw new Error(long.error);
    expect(long.proposal.lessons[0]?.title).toHaveLength(200);
    expect(long.proposal.lessons[0]?.goal).toHaveLength(300);
    expect(long.clipped).toBe(true);
  });

  it("names, with the existing check, outcomes never taught and taught only after a test", () => {
    const d = planned();
    d.assessments[1]!.week = 6;
    const r = parseLessonsDesign(
      answer([lesson("SQL na de toets", 7, [2]), lesson("Ontwerpen", 2, [1])]),
      d,
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.proposal.untaught).toEqual(["lo-c"]);
    // Only a summative test counts, as in the check: the formative one in week 4 does not.
    expect(r.proposal.late).toEqual([{ outcomeId: "lo-b", assessment: "Beroepsproduct", week: 6 }]);
  });

  it("reports nothing proposed with the AI's notes, and rejects what is not JSON", () => {
    expect(parseLessonsDesign(answer([], "Hoeveel weken duurt de cursus?"), planned())).toEqual({
      ok: false,
      error: "empty",
      notes: "Hoeveel weken duurt de cursus?",
    });
    expect(parseLessonsDesign("geen json", planned())).toEqual({
      ok: false,
      error: "unparseable",
    });
  });
});

describe("parseLessonsSelection and applyLessons", () => {
  const row = (key: string, fields: [string, string][]): [string, string][] => [
    ["lessonKey", key],
    ...fields.map(([k, v]): [string, string] => [`${key}.${k}`, v]),
  ];

  it("adds the ticked lessons with goal, week, outcomes and discipline", () => {
    const d = planned({ disciplines: [{ id: "d-web", name: "Webtech" }] });
    const s = parseLessonsSelection(
      fd([
        ...row("l1", [
          ["pick", "on"],
          ["title", "Kennismaken met SQL"],
          ["week", "1"],
          ["kind", "lesson"],
          ["goal", "De student schrijft een eerste SELECT."],
          ["outcomes", "lo-b"],
          ["outcomes", "lo-c"],
          ["discipline", "d-web"],
        ]),
        ...row("l2", [
          ["title", "Niet gekozen"],
          ["kind", "lesson"],
        ]),
        ...row("l3", [
          ["pick", "on"],
          ["title", "Opdracht datamodel"],
          ["kind", "assignment"],
          ["week", ""],
          ["goal", ""],
          ["discipline", ""],
        ]),
      ]),
    );
    if (!s) throw new Error("selection");
    const r = applyLessons(d, s);
    if (!r.ok) throw new Error(r.error);
    expect(r.added).toBe(2);
    expect(r.data.activities).toHaveLength(2);
    expect(r.data.activities[0]).toMatchObject({
      title: "Kennismaken met SQL",
      week: 1,
      kind: "lesson",
      goal: "De student schrijft een eerste SELECT.",
      outcomeIds: ["lo-b", "lo-c"],
      disciplineId: "d-web",
    });
    expect(r.data.activities[1]).toMatchObject({
      title: "Opdracht datamodel",
      kind: "assignment",
      outcomeIds: [],
    });
    expect(r.data.activities[1]?.week).toBeUndefined();
    expect(r.data.activities[1]?.goal).toBeUndefined();
  });

  it("never adds a lesson the course already has in that week", () => {
    const d = planned({
      activities: [
        { id: "x", title: "Kennismaken met SQL", week: 1, kind: "lesson", outcomeIds: [] },
      ],
    });
    const s = parseLessonsSelection(
      fd(
        row("l1", [
          ["pick", "on"],
          ["title", "kennismaken met sql."],
          ["week", "1"],
          ["kind", "lesson"],
        ]),
      ),
    );
    const r = s && applyLessons(d, s);
    expect(r).toMatchObject({ ok: true, added: 0 });
  });

  it("refuses a form that is off: no rows, bad keys, odd kinds, outcomes not in the course", () => {
    expect(parseLessonsSelection(fd([]))).toBe(null);
    expect(
      parseLessonsSelection(
        fd(
          row("x1", [
            ["title", "Les"],
            ["kind", "lesson"],
          ]),
        ),
      ),
    ).toBe(null);
    expect(
      parseLessonsSelection(
        fd(
          row("l1", [
            ["title", "Les"],
            ["kind", "lecture"],
          ]),
        ),
      ),
    ).toBe(null);
    expect(
      parseLessonsSelection(
        fd([
          ...row("l1", [
            ["title", "A"],
            ["kind", "lesson"],
          ]),
          ...row("l1", [["title", "B"]]),
        ]),
      ),
    ).toBe(null);
    const foreign = parseLessonsSelection(
      fd(
        row("l1", [
          ["pick", "on"],
          ["title", "Les"],
          ["kind", "lesson"],
          ["outcomes", "lo-elders"],
        ]),
      ),
    );
    expect(foreign && applyLessons(planned(), foreign)).toEqual({ ok: false, error: "invalid" });
    const noDiscipline = parseLessonsSelection(
      fd(
        row("l1", [
          ["pick", "on"],
          ["title", "Les"],
          ["kind", "lesson"],
          ["discipline", "d-elders"],
        ]),
      ),
    );
    expect(noDiscipline && applyLessons(planned(), noDiscipline)).toEqual({
      ok: false,
      error: "invalid",
    });
  });

  it("refuses more lessons than a course can hold", () => {
    const full = planned({
      activities: Array.from({ length: 100 }, (_, i) => ({
        id: `a${i}`,
        title: `Les ${i}`,
        kind: "lesson" as const,
        outcomeIds: [],
      })),
    });
    const s = parseLessonsSelection(
      fd(
        row("l1", [
          ["pick", "on"],
          ["title", "Nog een les"],
          ["kind", "lesson"],
        ]),
      ),
    );
    expect(s && applyLessons(full, s)).toEqual({ ok: false, error: "limit" });
  });
});
