import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getToolBySlug } from "~/lib/registry";
import { parseHardChecks } from "../../scripts/eval-helpers";

const dir = join(__dirname, "../../evals/group-feedback");
const rubric = readFileSync(join(dir, "rubric.md"), "utf8");
const cases = JSON.parse(readFileSync(join(dir, "cases.json"), "utf8")).cases as {
  id: string;
  description: string;
  outputLanguage: string;
  values: Record<string, string>;
}[];

/** The quality gate of brief P36.2 (five cases, two with a known error). */
describe("group-feedback eval meets the P36.2 quality gate", () => {
  it("has at least five cases: three ordinary, two with a known error, one in English", () => {
    expect(cases.length).toBeGreaterThanOrEqual(5);
    const known = cases.filter((c) => /known-error/.test(c.id));
    expect(known.length).toBeGreaterThanOrEqual(2);
    expect(cases.length - known.length).toBeGreaterThanOrEqual(3);
    expect(cases.some((c) => c.outputLanguage === "en")).toBe(true);
  });

  it("has the brief's known errors: a number not in the input, a student's fragment", () => {
    for (const kind of ["invented-number", "literal-fragment"]) {
      expect(
        cases.some((c) => c.id.startsWith(kind) && /known-error/.test(c.id)),
        kind,
      ).toBe(true);
    }
  });

  it("only uses the tool's own inputs and valid options", () => {
    const tool = getToolBySlug("group-feedback")!;
    for (const c of cases) {
      for (const [key, value] of Object.entries(c.values)) {
        const field = tool.inputs.find((f) => f.name === key);
        expect(field, `${c.id}: ${key}`).toBeDefined();
        if (field?.options)
          expect(
            field.options.map((o) => o.value),
            c.id,
          ).toContain(value);
      }
    }
  });

  it("judges the brief's own expectations", () => {
    expect(parseHardChecks(rubric).map((c) => c.id)).toEqual(
      expect.arrayContaining([
        "missedKnownError",
        "inventedNumber",
        "literalStudentFragment",
        "unmarkedExample",
        "judgedPersons",
        "inventedSources",
      ]),
    );
  });
});
