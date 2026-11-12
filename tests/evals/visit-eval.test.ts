import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getToolBySlug } from "~/lib/registry";
import { parseHardChecks } from "../../scripts/eval-helpers";

type Case = { id: string; outputLanguage: string; values: Record<string, string> };
const load = (tool: string) => {
  const dir = join(__dirname, "../../evals", tool);
  return {
    rubric: readFileSync(join(dir, "rubric.md"), "utf8"),
    cases: JSON.parse(readFileSync(join(dir, "cases.json"), "utf8")).cases as Case[],
  };
};

/** P38.6: the visit tools have evals with fictional cases, a known error and an English case. */
describe.each([
  ["visit-prep", ["missedKnownError", "aboutAStudent", "judged", "inventedCriteria"]],
  ["visit-report", ["missedKnownError", "invented", "judged", "realName"]],
])("%s eval", (slug, checks) => {
  const { rubric, cases } = load(slug);

  it("has at least four cases: one with a known error, one in English", () => {
    expect(cases.length).toBeGreaterThanOrEqual(4);
    expect(cases.some((c) => /known-error/.test(c.id))).toBe(true);
    expect(cases.some((c) => c.outputLanguage === "en")).toBe(true);
  });

  it("only uses the tool's own inputs and valid options", () => {
    const tool = getToolBySlug(slug)!;
    for (const c of cases)
      for (const [key, value] of Object.entries(c.values)) {
        const field = tool.inputs.find((f) => f.name === key);
        expect(field, `${c.id}: ${key}`).toBeDefined();
        if (field?.options)
          expect(
            field.options.map((o) => o.value),
            c.id,
          ).toContain(value);
      }
  });

  it("judges the brief's own expectations", () => {
    expect(parseHardChecks(rubric).map((c) => c.id)).toEqual(expect.arrayContaining(checks));
  });
});
