import { describe, expect, it } from "vitest";
import { loc } from "~/lib/i18n/localized";
import { ALL_TOOLS, getToolBySlug } from "~/lib/registry";

describe("task-first tool names (P19.1)", () => {
  it("gives every tool a bilingual subtitle that holds the book/technique name", () => {
    for (const tool of ALL_TOOLS) {
      expect(loc(tool.subtitle, "nl").trim(), `${tool.slug} subtitle nl`).toBeTruthy();
      expect(loc(tool.subtitle, "en").trim(), `${tool.slug} subtitle en`).toBeTruthy();
    }
  });

  it("keeps names short and free of the old 'Name — technique' pattern", () => {
    for (const tool of ALL_TOOLS) {
      for (const lang of ["nl", "en"] as const) {
        const name = loc(tool.name, lang);
        expect(name.length, `${tool.slug} ${lang}: ${name}`).toBeLessThanOrEqual(40);
        expect(name, `${tool.slug} ${lang}`).not.toContain("—");
      }
    }
  });

  it("never repeats the title as its own subtitle", () => {
    for (const tool of ALL_TOOLS) {
      expect(loc(tool.subtitle, "nl")).not.toBe(loc(tool.name, "nl"));
      expect(loc(tool.subtitle, "en")).not.toBe(loc(tool.name, "en"));
    }
  });

  it("makes the student-work assessor findable by its task, and still by 'stage'", () => {
    // P24.1: broadened from internship/thesis to any student work; the subtitle
    // keeps "stage"/"internship" so search still finds it.
    const tool = getToolBySlug("stage-assessment");
    expect(loc(tool?.name, "nl")).toBe("Studentwerk beoordelen en feedback geven");
    expect(loc(tool?.name, "en").toLowerCase()).toContain("student work");
    expect(loc(tool?.subtitle, "nl")).toContain("Beoordelingsassistent");
    expect(loc(tool?.subtitle, "nl").toLowerCase()).toContain("stage");
    expect(loc(tool?.subtitle, "en").toLowerCase()).toContain("internship");
  });

  it("keeps slugs and ids unchanged", () => {
    expect(ALL_TOOLS.map((t) => t.slug).sort()).toEqual(
      [
        "arcs-reactor",
        "authentic-assessment",
        "bloom-by-design",
        "clear-assignment",
        "cognitive-architect",
        "contextualization",
        "defend-your-work",
        "dialogic-encounters",
        "differentiation",
        "difficult-conversation",
        "engagement-check",
        "forum-autograder",
        "guided-reflection",
        "lesson-plan",
        "math-grading",
        "mentorai",
        "peer-tutoring",
        "rubric-builder",
        "scaffolding-feedback",
        "socratic-partner",
        "stage-assessment",
        "test-analysis",
        "test-items",
        "think-pair-share",
      ].sort(),
    );
  });
});
