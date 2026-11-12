import { describe, expect, it } from "vitest";
import { getToolBySlug } from "~/lib/registry";

/** P38.6: the final interview tools take the criteria and the weak points of a track. */
const field = (slug: string, name: string) =>
  getToolBySlug(slug)?.inputs.find((f) => f.name === name)?.prefillFromTrack;

describe("final interview from a track (P38.6)", () => {
  it("Verdedig je werk gets the criteria as objective and the weak points to defend", () => {
    expect(field("defend-your-work", "learningObjective")).toEqual({ source: "criteria" });
    expect(field("defend-your-work", "focusAreas")).toEqual({ source: "weakPoints" });
  });

  it("Een verdediging nakijken gets the criteria as objective", () => {
    expect(field("defense-review", "learningObjective")).toEqual({ source: "criteria" });
  });
});
