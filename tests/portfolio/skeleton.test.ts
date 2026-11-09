import { describe, expect, it } from "vitest";
import { DossierDataSchema } from "~/lib/portfolio/schema";
import { skeletonOutcomes } from "~/lib/portfolio/skeleton";

describe("skeletonOutcomes", () => {
  it("gives the five national BDB core tasks", () => {
    const outcomes = skeletonOutcomes(["bdb"], "nl");
    expect(outcomes.map((o) => o.code)).toEqual(["BDB-1", "BDB-2", "BDB-3", "BDB-4", "BDB-5"]);
    expect(outcomes[0]!.title).toBe("Doceren");
    for (const o of outcomes) expect(o.criteria.length).toBeGreaterThan(0);
  });

  it("gives BKE-1..3 and combines tracks, with unique ids", () => {
    const both = skeletonOutcomes(["bdb", "bke"], "en");
    expect(both.map((o) => o.code)).toContain("BKE-3");
    expect(both).toHaveLength(8);
    const ids = both.flatMap((o) => [o.id, ...o.criteria.map((c) => c.id)]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(both[0]!.title).toBe("Teaching");
  });

  it("produces a valid framework", () => {
    const outcomes = skeletonOutcomes(["bdb", "bke"], "nl");
    const parsed = DossierDataSchema.safeParse({
      tracks: ["bdb", "bke"],
      framework: { institution: "", outcomes, requirements: {} },
      status: {},
      evidence: [],
      chapters: [],
      references: [],
      coachMode: "coach",
      aiLog: [],
    });
    expect(parsed.success).toBe(true);
  });
});
