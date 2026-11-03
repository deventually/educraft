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

  it("makes the internship-report checker findable by its task", () => {
    const tool = getToolBySlug("stage-assessment");
    expect(loc(tool?.name, "nl")).toContain("Stageverslag");
    expect(loc(tool?.name, "en").toLowerCase()).toContain("internship report");
    expect(loc(tool?.subtitle, "nl")).toContain("Beoordelingsassistent");
  });

  it("keeps slugs and ids unchanged", () => {
    expect(ALL_TOOLS.map((t) => t.slug).sort()).toEqual(
      [
        "arcs-reactor",
        "authentic-assessment",
        "bloom-by-design",
        "cognitive-architect",
        "contextualization",
        "dialogic-encounters",
        "forum-autograder",
        "guided-reflection",
        "math-grading",
        "mentorai",
        "peer-tutoring",
        "scaffolding-feedback",
        "socratic-partner",
        "stage-assessment",
        "think-pair-share",
      ].sort(),
    );
  });
});
