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
});
