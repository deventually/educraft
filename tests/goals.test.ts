import { describe, it, expect } from "vitest";
import { getEnabledTools } from "~/lib/registry";
import { GOALS, GOAL_ORDER, TOOL_GOALS, TOOL_KEYWORDS } from "~/lib/registry/goals";

describe("teaching-goal taxonomy", () => {
  const enabled = getEnabledTools();

  it("maps every enabled tool to a known goal", () => {
    for (const tool of enabled) {
      const goal = TOOL_GOALS[tool.slug];
      expect(goal, `${tool.slug} has no goal`).toBeDefined();
      expect(GOALS[goal]).toBeDefined();
    }
  });

  it("GOAL_ORDER lists every goal exactly once", () => {
    expect([...GOAL_ORDER].sort()).toEqual(Object.keys(GOALS).sort());
    expect(new Set(GOAL_ORDER).size).toBe(GOAL_ORDER.length);
  });

  it("every goal has NL + EN name and blurb", () => {
    for (const goal of Object.values(GOALS)) {
      for (const field of [goal.name, goal.blurb] as const) {
        expect(typeof field).toBe("object");
        expect((field as Record<string, string>).nl?.trim()).toBeTruthy();
        expect((field as Record<string, string>).en?.trim()).toBeTruthy();
      }
      expect(goal.icon.trim()).toBeTruthy();
      expect(["instructor", "student"]).toContain(goal.audience);
    }
  });

  it("a goal's audience matches every tool filed under it", () => {
    for (const tool of enabled) {
      const goal = GOALS[TOOL_GOALS[tool.slug]];
      expect(goal.audience).toBe(tool.userType);
    }
  });

  it("every enabled tool has non-empty search keywords", () => {
    for (const tool of enabled) {
      const keywords = TOOL_KEYWORDS[tool.slug];
      expect(keywords, `${tool.slug} has no keywords`).toBeDefined();
      expect(keywords.length).toBeGreaterThan(0);
    }
  });
});
