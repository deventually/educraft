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
});
