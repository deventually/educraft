import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getToolBySlug } from "~/lib/registry";
import { parseHardChecks } from "../../scripts/eval-helpers";

const dir = join(__dirname, "../../evals/defense-review");
const rubric = readFileSync(join(dir, "rubric.md"), "utf8");
const cases = JSON.parse(readFileSync(join(dir, "cases.json"), "utf8")).cases as {
  id: string;
  outputLanguage: "nl" | "en";
  values: Record<string, string>;
}[];

/** The measurement of brief P31, 31.2: a strong, a weak, an AI-led and an English defense. */
describe("defense-review eval follows brief P31.2", () => {
  it("has the five cases", () => {
    expect(cases.map((c) => c.id).sort()).toEqual(
      [
        "ai-gave-answers-nl",
        "internship-care-mbo4-nl",
        "not-a-defense-nl",
        "research-project-wo-en",
        "vague-report-hbo-nl",
      ].sort(),
    );
    expect(cases.some((c) => c.outputLanguage === "en")).toBe(true);
  });

  it("only uses the tool's own inputs, with every required one filled", () => {
    const inputs = getToolBySlug("defense-review")!.inputs;
    const names = new Set(inputs.map((f) => f.name));
    for (const c of cases) {
      for (const key of Object.keys(c.values)) expect(names.has(key), `${c.id}: ${key}`).toBe(true);
      for (const f of inputs.filter((i) => i.required)) {
        expect(c.values[f.name], `${c.id}: ${f.name}`).toBeTruthy();
      }
    }
  });

  it("sends only anonymised transcripts: codes, labelled turns", () => {
    for (const c of cases.filter((x) => x.id !== "not-a-defense-nl")) {
      expect(c.values.transcript, c.id).toMatch(/^\[AI\] /);
      expect(c.values.transcript, c.id).toContain("\n[Student] ");
    }
    expect(cases.some((c) => /\[BEDRIJF\]/.test(c.values.transcript ?? ""))).toBe(true);
  });

  it("caps the failures that matter most", () => {
    const checks = parseHardChecks(rubric);
    const cap = (id: string) => checks.find((c) => c.id === id)?.cap;
    expect(cap("creditedAiWords")).toBe(1);
    expect(cap("inventedQuote")).toBe(1);
    expect(cap("gaveGrade")).toBe(2);
    expect(cap("guessedIdentity")).toBe(2);
    expect(cap("analysedNonDefense")).toBe(1);
    // Meting dr1: the judge failed "Uitstekend" while the case expected Proficient or Exemplary.
    expect(checks.find((c) => c.id === "implausibleRating")?.question).toContain(
      "A rating inside the expected band never fails",
    );
  });
});
