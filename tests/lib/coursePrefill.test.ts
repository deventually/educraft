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
});
