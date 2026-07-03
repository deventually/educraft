import { describe, it, expect } from "vitest";
import { ALL_TOOLS, getEnabledTools } from "~/lib/registry";
import { validateTools } from "~/lib/registry/validate";

describe("tool registry", () => {
  it("has no validation issues", () => {
    const issues = validateTools(ALL_TOOLS);
    expect(issues, JSON.stringify(issues, null, 2)).toEqual([]);
  });

  it("exposes at least the four MVP tools as enabled", () => {
    expect(getEnabledTools().length).toBeGreaterThanOrEqual(4);
  });

  it("has unique slugs", () => {
    const slugs = ALL_TOOLS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every chat tool has a chat config", () => {
    for (const tool of ALL_TOOLS) {
      if (tool.mode === "chat") expect(tool.chat).toBeDefined();
    }
  });

  it("gives every tool a positive maxTokens budget", () => {
    for (const tool of ALL_TOOLS) {
      const budgets = [tool.defaultMaxTokens, ...tool.stages.map((s) => s.maxTokens)].filter(
        (n): n is number => typeof n === "number",
      );
      expect(budgets.length, `${tool.slug} declares no maxTokens`).toBeGreaterThan(0);
      for (const n of budgets) expect(n).toBeGreaterThan(0);
    }
  });
});

describe("maxTokens validation", () => {
  const base = structuredClone(ALL_TOOLS.find((t) => t.slug === "socratic-partner"));
  if (!base) throw new Error("socratic-partner fixture missing");

  it("accepts a sane defaultMaxTokens", () => {
    const tool = { ...structuredClone(base), defaultMaxTokens: 6144 };
    expect(validateTools([tool])).toEqual([]);
  });

  it("rejects a non-positive defaultMaxTokens", () => {
    const tool = { ...structuredClone(base), defaultMaxTokens: 0 };
    expect(validateTools([tool]).some((i) => /maxTokens/i.test(i.message))).toBe(true);
  });

  it("rejects an absurdly large defaultMaxTokens (> 32k)", () => {
    const tool = { ...structuredClone(base), defaultMaxTokens: 40_000 };
    expect(validateTools([tool]).some((i) => /maxTokens/i.test(i.message))).toBe(true);
  });

  it("rejects a non-positive stage maxTokens", () => {
    const tool = structuredClone(base);
    tool.stages[0].maxTokens = -1;
    expect(validateTools([tool]).some((i) => /maxTokens/i.test(i.message))).toBe(true);
  });
});
