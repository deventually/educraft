import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getToolBySlug } from "~/lib/registry";
import { COUNTED_CHECKS, parseHardChecks } from "../../scripts/eval-helpers";

const dir = join(__dirname, "../../evals/clear-assignment");
const rubric = readFileSync(join(dir, "rubric.md"), "utf8");
const cases = JSON.parse(readFileSync(join(dir, "cases.json"), "utf8")).cases as {
  id: string;
  description: string;
  outputLanguage: string;
  values: Record<string, string>;
}[];

/** The quality gate of brief P24 for a new tool (24.6). */
describe("clear-assignment eval meets the P24 quality gate", () => {
  it("has at least five cases: three ordinary, two with a known error, one in English", () => {
    expect(cases.length).toBeGreaterThanOrEqual(5);
    const known = cases.filter((c) => /known-error/.test(c.id));
    expect(known.length).toBeGreaterThanOrEqual(2);
    expect(cases.length - known.length).toBeGreaterThanOrEqual(3);
    expect(cases.some((c) => c.outputLanguage === "en")).toBe(true);
  });

  it("has the known errors: missing info, contradicting requirements, criteria that are not observable", () => {
    for (const kind of ["missing-info", "contradiction", "vague-criteria"]) {
      expect(
        cases.some((c) => c.id.startsWith(kind) && /known-error/.test(c.id)),
        kind,
      ).toBe(true);
    }
  });

  it("covers more than one reading level", () => {
    const levels = new Set(cases.map((c) => c.values.readingLevel ?? "B1"));
    expect(levels.size).toBeGreaterThanOrEqual(3);
  });

  it("only uses the tool's own inputs, and every case has an assignment text", () => {
    const names = new Set(getToolBySlug("clear-assignment")!.inputs.map((f) => f.name));
    for (const c of cases) {
      for (const key of Object.keys(c.values)) expect(names.has(key), `${c.id}: ${key}`).toBe(true);
      expect(c.values.assignment?.length, c.id).toBeGreaterThan(200);
    }
  });

  it("judges the brief's own expectations, including finding the known error", () => {
    expect(rubric).toMatch(/CEFR/);
    expect(rubric).toMatch(/UDL/);
    const ids = parseHardChecks(rubric).map((c) => c.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "missedKnownError",
        "droppedRequirement",
        "addedRequirement",
        "silentChoice",
        "aboveLevel",
        "inventedSources",
        "tooManyOpenPoints",
      ]),
    );
    expect(parseHardChecks(rubric).find((c) => c.id === "tooManyOpenPoints")?.counted).toBe(true);
  });
});

describe("tooManyOpenPoints (counted)", () => {
  const output = (n: number, heading = "## Open punten") =>
    [
      "## Herschreven opdracht",
      "### Stappen",
      ...Array.from({ length: 12 }, (_, i) => `${i + 1}. Stap ${i + 1}.`),
      heading,
      ...Array.from({ length: n }, (_, i) => `${i + 1}. Je noemt punt ${i + 1} niet.`),
      "",
      "Ook: de bestandsnaam en de contactpersoon.",
      "## Wat ik heb veranderd",
      "- Zinnen ingekort.",
    ].join("\n");

  it("fails more than eight numbered open points (meting ca2 had 14)", () => {
    expect(COUNTED_CHECKS.tooManyOpenPoints(output(14))).toBe(true);
    expect(COUNTED_CHECKS.tooManyOpenPoints(output(9, "## Open points"))).toBe(true);
  });

  it("passes eight or fewer, and does not count the steps of the assignment", () => {
    expect(COUNTED_CHECKS.tooManyOpenPoints(output(8))).toBe(false);
    expect(COUNTED_CHECKS.tooManyOpenPoints(output(3, "## Open points"))).toBe(false);
  });
});
