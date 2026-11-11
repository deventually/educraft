import { describe, expect, it } from "vitest";
import { coursePrefillValues } from "~/lib/forms/values";
import type { InputField } from "~/lib/registry/types";

const fields: InputField[] = [
  { name: "topic", label: "Onderwerp", kind: "text" },
  {
    name: "outcomes",
    label: "Leeruitkomsten",
    kind: "textarea",
    prefillFromCourse: { source: "learningOutcomes" },
  },
];

describe("coursePrefillValues", () => {
  it("fills a course-backed field with one learning outcome per line", () => {
    const course = {
      outcomes: [
        { id: "a", text: "Je ontwerpt een datamodel." },
        { id: "b", text: "Je legt normaliseren uit." },
      ],
    };
    expect(coursePrefillValues(fields, course)).toEqual({
      outcomes: "- Je ontwerpt een datamodel.\n- Je legt normaliseren uit.",
    });
  });

  it("returns nothing without a course or without outcomes", () => {
    expect(coursePrefillValues(fields, null)).toEqual({});
    expect(coursePrefillValues(fields, { outcomes: [] })).toEqual({});
  });

  // A tool opened from a lesson or test (P27.4) knows which one: it fills in that item.
  describe("from a course item", () => {
    const itemFields: InputField[] = [
      ...fields,
      {
        name: "content",
        label: "Inhoud",
        kind: "textarea",
        prefillFromCourse: { source: "itemTitle" },
      },
      {
        name: "prior",
        label: "Voorkennis",
        kind: "textarea",
        prefillFromCourse: { source: "earlierLessons" },
      },
    ];
    const course = {
      outcomes: [
        { id: "a", text: "Je ontwerpt een datamodel." },
        { id: "b", text: "Je legt normaliseren uit." },
      ],
      items: [
        {
          id: "l1",
          title: "Intro databases",
          week: 1,
          kind: "activity" as const,
          outcomeIds: ["a"],
        },
        { id: "l3", title: "Normaliseren", week: 3, kind: "activity" as const, outcomeIds: ["b"] },
        { id: "l2", title: "ERD tekenen", week: 2, kind: "activity" as const, outcomeIds: ["a"] },
        { id: "t2", title: "Oefentoets", week: 2, kind: "assessment" as const, outcomeIds: ["a"] },
        { id: "lx", title: "Zonder week", kind: "activity" as const, outcomeIds: [] },
      ],
    };

    it("fills only the item's own learning outcomes, its title and the lessons before it", () => {
      expect(coursePrefillValues(itemFields, course, "l3")).toEqual({
        outcomes: "- Je legt normaliseren uit.",
        content: "Normaliseren",
        prior: "- Week 1: Intro databases\n- Week 2: ERD tekenen",
      });
    });

    it("falls back to all outcomes for an item without any, and skips what it does not know", () => {
      expect(coursePrefillValues(itemFields, course, "lx")).toEqual({
        outcomes: "- Je ontwerpt een datamodel.\n- Je legt normaliseren uit.",
        content: "Zonder week",
      });
    });

    it("names at most the five lessons just before it", () => {
      const many = {
        outcomes: course.outcomes,
        items: Array.from({ length: 8 }, (_, i) => ({
          id: `w${i + 1}`,
          title: `Les ${i + 1}`,
          week: i + 1,
          kind: "activity" as const,
          outcomeIds: [],
        })),
      };
      expect(coursePrefillValues(itemFields, many, "w8").prior).toBe(
        ["Week 3: Les 3", "Week 4: Les 4", "Week 5: Les 5", "Week 6: Les 6", "Week 7: Les 7"]
          .map((l) => `- ${l}`)
          .join("\n"),
      );
    });

    it("fills no item fields without an item, or for an unknown one", () => {
      const all = { outcomes: "- Je ontwerpt een datamodel.\n- Je legt normaliseren uit." };
      expect(coursePrefillValues(itemFields, course)).toEqual(all);
      expect(coursePrefillValues(itemFields, course, "gone")).toEqual(all);
    });
  });

  // The schedule fills the practical fields, with or without an item.
  it("fills the lesson length, group size and delivery mode from the schedule", () => {
    const practical: InputField[] = [
      {
        name: "duration",
        label: "Lesduur",
        kind: "number",
        prefillFromCourse: { source: "sessionMinutes" },
      },
      {
        name: "groupSize",
        label: "Groep",
        kind: "number",
        prefillFromCourse: { source: "groupSize" },
      },
      {
        name: "mode",
        label: "Vorm",
        kind: "select",
        prefillFromCourse: { source: "deliveryMode" },
      },
    ];
    const course = {
      outcomes: [],
      schedule: { sessionMinutes: 240, groupSize: 28, deliveryMode: "online" as const },
    };
    expect(coursePrefillValues(practical, course)).toEqual({
      duration: 240,
      groupSize: 28,
      mode: "online",
    });
    expect(coursePrefillValues(practical, { outcomes: [] })).toEqual({});
  });

  // With disciplines, a lesson gets its discipline's share of the week.
  it("fills a lesson's length from its discipline's hours, split over its lessons that week", () => {
    const duration: InputField[] = [
      {
        name: "duration",
        label: "Lesduur",
        kind: "number",
        prefillFromCourse: { source: "sessionMinutes" },
      },
    ];
    const lesson = (id: string, week: number, disciplineId?: string) => ({
      id,
      title: id,
      week,
      kind: "activity" as const,
      outcomeIds: [],
      ...(disciplineId && { disciplineId }),
    });
    const course = {
      outcomes: [],
      schedule: { sessionMinutes: 240 },
      disciplines: [
        { id: "web", name: "Webtech", hoursPerWeek: 6 },
        { id: "pv", name: "Professionele vaardigheden", hoursPerWeek: 2 },
        { id: "hw", name: "Hardware" },
      ],
      items: [
        lesson("w1", 3, "web"),
        lesson("w2", 3, "web"),
        lesson("p1", 3, "pv"),
        lesson("h1", 3, "hw"),
        lesson("x", 3),
      ],
    };
    expect(coursePrefillValues(duration, course, "w1")).toEqual({ duration: 180 });
    expect(coursePrefillValues(duration, course, "p1")).toEqual({ duration: 120 });
    // No hours for the discipline, or no discipline: the session length.
    expect(coursePrefillValues(duration, course, "h1")).toEqual({ duration: 240 });
    expect(coursePrefillValues(duration, course, "x")).toEqual({ duration: 240 });
    // Never longer than a session.
    const long = { ...course, disciplines: [{ id: "web", name: "Webtech", hoursPerWeek: 12 }] };
    expect(coursePrefillValues(duration, long, "w1")).toEqual({ duration: 240 });
  });

  // Opened from a lesson in Les voorbereiden: its goal, its discipline and that discipline's lessons.
  describe("from a lesson with a goal or a discipline", () => {
    const lessonFields: InputField[] = [
      {
        name: "goal",
        label: "Leerdoel",
        kind: "textarea",
        prefillFromCourse: { source: "lessonGoal" },
      },
      {
        name: "content",
        label: "Inhoud",
        kind: "textarea",
        prefillFromCourse: { source: "itemTitle" },
      },
      {
        name: "prior",
        label: "Voorkennis",
        kind: "textarea",
        prefillFromCourse: { source: "earlierLessons" },
      },
    ];
    const lesson = (id: string, week: number, extra: object = {}) => ({
      id,
      title: id,
      week,
      kind: "activity" as const,
      outcomeIds: ["a"],
      ...extra,
    });
    const course = {
      outcomes: [
        { id: "a", text: "Je bouwt een webpagina." },
        { id: "b", text: "Je presenteert je werk." },
      ],
      disciplines: [
        { id: "web", name: "Webtech" },
        { id: "pv", name: "Professionele vaardigheden" },
      ],
      items: [
        lesson("HTML", 1, { disciplineId: "web" }),
        lesson("Pitchen", 1, { disciplineId: "pv" }),
        lesson("Flexbox", 2, { disciplineId: "web" }),
        lesson("Zonder vak", 2),
        lesson("CSS-grid", 3, {
          disciplineId: "web",
          goal: "De student zet een pagina op met CSS-grid.",
        }),
        lesson("Feedback", 3, { disciplineId: "pv" }),
      ],
    };

    it("fills the lesson's goal, its discipline and only that discipline's earlier lessons", () => {
      expect(coursePrefillValues(lessonFields, course, "CSS-grid")).toEqual({
        goal: "De student zet een pagina op met CSS-grid.",
        content: "Webtech: CSS-grid",
        prior: "- Week 1: HTML\n- Week 2: Flexbox",
      });
    });

    it("falls back to the lesson's outcomes without a goal, and to all lessons without a discipline", () => {
      expect(coursePrefillValues(lessonFields, course, "Feedback")).toEqual({
        goal: "- Je bouwt een webpagina.",
        content: "Professionele vaardigheden: Feedback",
        prior: "- Week 1: Pitchen",
      });
      expect(coursePrefillValues(lessonFields, course, "Zonder vak")).toEqual({
        goal: "- Je bouwt een webpagina.",
        content: "Zonder vak",
        prior: "- Week 1: HTML\n- Week 1: Pitchen",
      });
    });

    it("fills all outcomes as the goal without a lesson", () => {
      expect(coursePrefillValues(lessonFields, course)).toEqual({
        goal: "- Je bouwt een webpagina.\n- Je presenteert je werk.",
      });
    });
  });
});
