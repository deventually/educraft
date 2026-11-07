import { describe, expect, it } from "vitest";
import { ALL_TOOLS, getToolBySlug } from "~/lib/registry";

/** The learning-outcome fields that a course fills in (brief P20, 20.4, BESLUIT-2026-11-05-1). */
const COURSE_FIELDS: [slug: string, field: string][] = [
  ["contextualization", "learningObjectives"],
  ["guided-reflection", "leeruitkomsten"],
  ["forum-autograder", "learningObjectives"],
  ["authentic-assessment", "leeruitkomsten"],
  ["cognitive-architect", "learningObjective"],
  ["test-items", "learningOutcomes"],
  ["rubric-builder", "learningOutcome"],
  ["bloom-by-design", "learningOutcome"],
  ["lesson-plan", "learningGoal"],
  ["differentiation", "learningGoal"],
  ["defend-your-work", "learningObjective"],
  ["defense-review", "learningObjective"],
  ["engagement-check", "learningObjective"],
];

describe("prefillFromCourse (data hook, no control flow)", () => {
  it.each(COURSE_FIELDS)("%s.%s declares prefillFromCourse", (slug, field) => {
    const input = getToolBySlug(slug)?.inputs.find((f) => f.name === field);
    expect(input?.prefillFromCourse).toEqual({ source: "learningOutcomes" });
  });

  it("is only declared on those fields, and only on text fields", () => {
    const declared = ALL_TOOLS.flatMap((t) =>
      t.inputs.filter((f) => f.prefillFromCourse).map((f) => [t.slug, f.name, f.kind]),
    );
    expect(declared.map(([slug, name]) => [slug, name]).sort()).toEqual([...COURSE_FIELDS].sort());
    for (const [, , kind] of declared) expect(["text", "textarea"]).toContain(kind);
  });
});
