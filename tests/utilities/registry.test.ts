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
