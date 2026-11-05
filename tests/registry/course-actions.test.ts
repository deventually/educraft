import { describe, expect, it } from "vitest";
import { ALL_TOOLS, getToolBySlugOrThrow } from "~/lib/registry";
import { validateTools } from "~/lib/registry/validate";
import {
  FINDING_TOOLS,
  courseToolHref,
  findingItemId,
  toolsForKind,
  validateFindingTools,
} from "~/lib/registry/courseActions";
import type { Tool } from "~/lib/registry/types";
import { alignedCourse, ACT1, LO1, QUIZ } from "../courses/fixtures";

/** P27.4: which tool shows as a button at which kind of course item is registry data. */
const base = getToolBySlugOrThrow("lesson-plan");
const withActions = (courseActions: unknown): Tool =>
  ({ ...base, next: undefined, courseActions }) as Tool;

describe("Tool.courseActions — validation (P27.4)", () => {
  it("accepts the three kinds of course item", () => {
    expect(validateTools([withActions(["outcome", "activity", "assessment"])])).toEqual([]);
  });

  it("refuses an unknown kind", () => {
    expect(validateTools([withActions(["lesson"])]).length).toBeGreaterThan(0);
  });

  it("refuses a kind listed twice", () => {
    const issues = validateTools([withActions(["activity", "activity"])]);
    expect(issues.map((i) => i.message).join("\n")).toMatch(/courseActions/);
  });
});

describe("Tool.courseActions — the data (P27.4)", () => {
  const kinds = (slug: string) => getToolBySlugOrThrow(slug).courseActions ?? [];

  it.each([
    ["authentic-assessment", ["outcome"]],
    ["bloom-by-design", ["outcome"]],
    ["lesson-plan", ["activity"]],
    ["differentiation", ["activity"]],
    ["clear-assignment", ["activity"]],
    ["test-items", ["assessment"]],
    ["rubric-builder", ["assessment"]],
    ["test-analysis", ["assessment"]],
  ])("%s → %j", (slug, expected) => {
    expect(kinds(slug)).toEqual(expected);
  });

  it("toolsForKind puts the preferred tool first, then registry order", () => {
    expect(toolsForKind(ALL_TOOLS, "activity").map((t) => t.slug)).toEqual([
      "lesson-plan",
      "clear-assignment",
      "differentiation",
    ]);
    expect(toolsForKind(ALL_TOOLS, "assessment").map((t) => t.slug)).toEqual([
      "test-items",
      "rubric-builder",
      "test-analysis",
    ]);
    expect(toolsForKind(ALL_TOOLS, "outcome").map((t) => t.slug)).toEqual([
      "authentic-assessment",
      "bloom-by-design",
    ]);
  });

  it("the real registry stays valid", () => {
    expect(validateTools(ALL_TOOLS)).toEqual([]);
  });
});

describe("FINDING_TOOLS — Los op met… (P27.4)", () => {
  it("maps the gaps to a tool", () => {
    expect(FINDING_TOOLS["outcome-not-assessed"]).toBe("test-items");
    expect(FINDING_TOOLS["outcome-not-taught"]).toBe("lesson-plan");
    expect(FINDING_TOOLS["bloom-below-outcome"]).toBe("test-items");
  });

  it("the real map is valid", () => {
    expect(validateFindingTools(FINDING_TOOLS, ALL_TOOLS)).toEqual([]);
  });

  it("refuses an unknown tool and an unknown finding code", () => {
    const issues = validateFindingTools(
      { "outcome-not-taught": "no-such-tool", "no-such-code": "test-items" } as never,
      ALL_TOOLS,
    );
    expect(issues.join("\n")).toMatch(/no-such-tool/);
    expect(issues.join("\n")).toMatch(/no-such-code/);
  });
});

describe("courseToolHref (P27.4)", () => {
  it("carries the course and the item", () => {
    expect(courseToolHref("test-items", "c 1", "it/1")).toBe(
      "/tools/test-items?course=c%201&item=it%2F1",
    );
  });

  it("leaves the item out when there is none", () => {
    expect(courseToolHref("lesson-plan", "c1")).toBe("/tools/lesson-plan?course=c1");
    expect(courseToolHref("lesson-plan", "c1", null)).toBe("/tools/lesson-plan?course=c1");
  });
});

describe("findingItemId (P27.4)", () => {
  const data = alignedCourse();

  it("is the activity or assessment a finding is about", () => {
    expect(findingItemId(data, QUIZ)).toBe(QUIZ);
    expect(findingItemId(data, ACT1)).toBe(ACT1);
  });

  it("is null for an outcome, an unknown id or nothing", () => {
    expect(findingItemId(data, LO1)).toBeNull();
    expect(findingItemId(data, "gone")).toBeNull();
    expect(findingItemId(data, undefined)).toBeNull();
  });
});

describe("itemKind (P27.4)", () => {
  const data = alignedCourse();
  it("names the kind of a course item, or null", async () => {
    const { itemKind } = await import("~/lib/registry/courseActions");
    expect(itemKind(data, LO1)).toBe("outcome");
    expect(itemKind(data, ACT1)).toBe("activity");
    expect(itemKind(data, QUIZ)).toBe("assessment");
    expect(itemKind(data, "gone")).toBeNull();
  });
});

describe("PREFERRED_TOOLS (P27.4)", () => {
  it("each preferred tool is offered at that kind", async () => {
    const { PREFERRED_TOOLS, GRADE_TOOL } = await import("~/lib/registry/courseActions");
    for (const [kind, slug] of Object.entries(PREFERRED_TOOLS))
      expect(getToolBySlugOrThrow(slug).courseActions).toContain(kind);
    expect(getToolBySlugOrThrow(GRADE_TOOL).courseActions).toContain("assessment");
  });
});

describe("courseToolsFor (P27.4)", () => {
  it("each button carries the tool's icon", async () => {
    process.env.DATABASE_URL = "file::memory:";
    const { courseToolsFor } = await import("~/server/courseTools.server");
    const tools = await courseToolsFor({ id: "icon-teacher", role: "teacher" } as never);
    expect(tools.activity[0]).toEqual({
      slug: "lesson-plan",
      name: getToolBySlugOrThrow("lesson-plan").name,
      icon: "calendar-clock",
    });
  });
});
