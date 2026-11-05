import { describe, it, expect } from "vitest";
import { UTILITIES, getUtilityBySlug } from "~/lib/utilities";

describe("utility registry", () => {
  it("lists the grade calculator", () => {
    expect(getUtilityBySlug("grade-calculator")?.id).toBe("grade-calculator");
  });

  it("returns undefined for an unknown slug", () => {
    expect(getUtilityBySlug("does-not-exist")).toBeUndefined();
  });

  it("has unique ids and slugs", () => {
    const ids = UTILITIES.map((u) => u.id);
    const slugs = UTILITIES.map((u) => u.slug);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("uses English URL slugs", () => {
    for (const u of UTILITIES) expect(u.slug).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });

  it("names and summarizes every utility in Dutch and English", () => {
    for (const u of UTILITIES) {
      for (const text of [u.name, u.summary]) {
        expect(typeof text).toBe("object");
        const t = text as { nl: string; en: string };
        expect(t.nl.trim()).not.toBe("");
        expect(t.en.trim()).not.toBe("");
        expect(t.nl).not.toBe(t.en);
      }
    }
  });
});

describe("utility registry — rubric", () => {
  it("lists the rubric utility at /utilities/rubric", () => {
    expect(getUtilityBySlug("rubric")?.id).toBe("rubric");
  });
});

describe("utility registry — item analysis (P24.5)", () => {
  it("lists the item analysis, explained by a registered tool", async () => {
    const { getToolBySlug } = await import("~/lib/registry");
    const u = getUtilityBySlug("item-analysis");
    expect(u?.id).toBe("item-analysis");
    expect(u?.explainWith).toBe("test-analysis");
    expect(getToolBySlug(u!.explainWith!)).toBeDefined();
  });

  it("only names registered tools as explainers", async () => {
    const { getToolBySlug } = await import("~/lib/registry");
    for (const u of UTILITIES) {
      if (u.explainWith) expect(getToolBySlug(u.explainWith), u.id).toBeDefined();
    }
  });
});
