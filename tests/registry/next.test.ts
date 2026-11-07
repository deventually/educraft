import { describe, expect, it } from "vitest";
import { ALL_TOOLS as TOOLS, getToolBySlugOrThrow } from "~/lib/registry";
import { validateTools } from "~/lib/registry/validate";
import type { Tool } from "~/lib/registry/types";

/** P27.1: "next steps" are registry data, validated at boot. */
const base = getToolBySlugOrThrow("rubric-builder");
const other = getToolBySlugOrThrow("stage-assessment");
const withNext = (next: string[]): Tool => ({ ...base, next });

describe("Tool.next — validation (P27.1)", () => {
  it("accepts known slugs", () => {
    expect(validateTools([withNext(["stage-assessment"]), other])).toEqual([]);
  });

  it("refuses an unknown slug", () => {
    const issues = validateTools([withNext(["no-such-tool"]), other]);
    expect(issues.map((i) => i.message).join("\n")).toMatch(/next.*no-such-tool/);
  });

  it("refuses a tool that points to itself", () => {
    const issues = validateTools([withNext(["rubric-builder"]), other]);
    expect(issues.map((i) => i.message).join("\n")).toMatch(/next.*itself/);
  });

  it("refuses more than three next steps", () => {
    const issues = validateTools([withNext(["a", "b", "c", "d"]), other]);
    expect(issues.length).toBeGreaterThan(0);
  });
});

describe("Tool.next — the first chains (P27.1)", () => {
  const next = (slug: string) => getToolBySlugOrThrow(slug).next ?? [];

  it.each([
    ["test-items", ["rubric-builder", "test-analysis"]],
    ["rubric-builder", ["stage-assessment"]],
    ["authentic-assessment", ["rubric-builder", "test-items"]],
    ["lesson-plan", ["differentiation", "clear-assignment", "engagement-check"]],
    ["guided-reflection", ["lesson-plan", "authentic-assessment"]],
    ["differentiation", ["clear-assignment", "engagement-check"]],
    ["clear-assignment", ["engagement-check"]],
    ["engagement-check", ["cognitive-architect", "differentiation"]],
  ])("%s → %j", (slug, expected) => {
    expect(next(slug)).toEqual(expected);
  });

  it("the real registry stays valid", () => {
    expect(validateTools(TOOLS)).toEqual([]);
  });
});
