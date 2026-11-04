import { describe, expect, it } from "vitest";
import { TOOL_HINTS, chapterHints, criterionHints } from "~/lib/portfolio/toolHints";
import { skeletonOutcomes } from "~/lib/portfolio/skeleton";
import { getToolBySlug } from "~/lib/registry";
import { getMessages } from "~/lib/i18n";
import type { Outcome } from "~/lib/portfolio/types";

const ALL = new Set(TOOL_HINTS.map((h) => h.slug));

function seed(code: string): Outcome {
  const o = skeletonOutcomes(["bdb", "bke"], "nl").find((x) => x.code === code);
  if (!o) throw new Error(code);
  return o;
}

function first(code: string) {
  const o = seed(code);
  return criterionHints(o, o.criteria[0], ALL);
}

describe("tool hints", () => {
  it("points only at tools that exist, with a how-to in both languages", () => {
    for (const h of TOOL_HINTS) {
      expect(getToolBySlug(h.slug), h.slug).toBeDefined();
      for (const locale of ["nl", "en"] as const) {
        expect(
          (getMessages(locale).portfolio.tools.how as Record<string, string>)[h.slug],
          `${locale}:${h.slug}`,
        ).toBeTruthy();
      }
    }
  });

  it("suggests a fitting tool for evidence on each public BDB/BKE outcome", () => {
    expect(first("BDB-1")).toContain("guided-reflection");
    expect(first("BDB-2")).toContain("arcs-reactor");
    expect(first("BDB-3")).toContain("contextualization");
    expect(first("BDB-4")[0]).toBe("authentic-assessment");
    expect(first("BKE-1")[0]).toBe("authentic-assessment");
  });

  it("matches English criteria too", () => {
    const en = skeletonOutcomes(["bdb", "bke"], "en");
    const hint = (code: string) => {
      const o = en.find((x) => x.code === code);
      if (!o) throw new Error(code);
      return criterionHints(o, o.criteria[0], ALL);
    };
    expect(hint("BDB-1")).toContain("guided-reflection");
    expect(hint("BDB-2")).toContain("arcs-reactor");
    expect(hint("BDB-3")).toContain("contextualization");
    expect(hint("BDB-4")[0]).toBe("authentic-assessment");
  });

  it("suggests at most two tools, and only tools the instance offers", () => {
    expect(first("BDB-1").length).toBeLessThanOrEqual(2);
    const o = seed("BDB-4");
    expect(criterionHints(o, o.criteria[0], new Set(["stage-assessment"]))).toEqual([
      "stage-assessment",
    ]);
    expect(criterionHints(o, o.criteria[0], new Set())).toEqual([]);
  });

  it("matches on the teacher's own criterion text before the outcome title", () => {
    const o: Outcome = {
      id: "o",
      code: "X",
      title: "Toetsen",
      criteria: [{ id: "c", text: "Je motiveert studenten tijdens de les." }],
      requiredEvidence: [],
    };
    expect(criterionHints(o, o.criteria[0], ALL)[0]).toBe("arcs-reactor");
  });

  it("suggests thinking partners for the chapter when it asks for theory or literature", () => {
    expect(chapterHints(seed("BKE-1"), ALL).length).toBeGreaterThan(0);
    expect(chapterHints(seed("BKE-1"), ALL).every((s) => !first("BKE-1").includes(s))).toBe(true);
  });

  it("suggests nothing when no tool clearly fits", () => {
    const o: Outcome = {
      id: "o",
      code: "X",
      title: "Overig",
      criteria: [{ id: "c", text: "Je bent op tijd aanwezig." }],
      requiredEvidence: [],
    };
    expect(criterionHints(o, o.criteria[0], ALL)).toEqual([]);
    expect(chapterHints(o, ALL)).toEqual([]);
  });
});
