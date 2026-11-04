import { describe, expect, it } from "vitest";
import { getToolBySlug } from "~/lib/registry";

/** Which fields go through the anonymise step is data on the field (`redact: true`), not code per tool. */
describe("fields with student work are anonymised", () => {
  it.each([
    ["stage-assessment", ["document", "companyEvaluation"]],
    ["forum-autograder", ["discussionThread"]],
  ])("%s", (slug, names) => {
    const tool = getToolBySlug(slug);
    expect(tool).toBeDefined();
    const redacted = tool?.inputs.filter((f) => f.redact).map((f) => f.name);
    expect(redacted).toEqual(names);
  });
});
