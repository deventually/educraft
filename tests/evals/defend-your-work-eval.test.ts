import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getToolBySlug } from "~/lib/registry";
import { parseHardChecks } from "../../scripts/eval-helpers";

const dir = join(__dirname, "../../evals/defend-your-work");
const rubric = readFileSync(join(dir, "rubric.md"), "utf8");
const cases = JSON.parse(readFileSync(join(dir, "cases.json"), "utf8")).cases as {
  id: string;
  description: string;
  outputLanguage: "nl" | "en";
  values: Record<string, string | number>;
  userTurns: string[];
}[];

/** The measurement of brief P31, 31.1: five cases, hard yes/no checks with a cap. */
describe("defend-your-work eval follows brief P31.1", () => {
  it("has the brief's five cases", () => {
    expect(cases.map((c) => c.id).sort()).toEqual(
      [
        "report-hbo-ict-nl",
        "internship-care-mbo4-nl",
        "research-project-wo-en",
        "student-begs-nl",
        "unsure-but-sound-nl",
      ].sort(),
    );
  });

  it("plays at least six student turns per case", () => {
    for (const c of cases) expect(c.userTurns.length, c.id).toBeGreaterThanOrEqual(6);
  });

  it("only uses the tool's own inputs, with every required one filled", () => {
    const inputs = getToolBySlug("defend-your-work")!.inputs;
    const names = new Set(inputs.map((f) => f.name));
    for (const c of cases) {
      for (const key of Object.keys(c.values)) expect(names.has(key), `${c.id}: ${key}`).toBe(true);
      for (const f of inputs.filter((i) => i.required)) {
        expect(c.values[f.name], `${c.id}: ${f.name}`).toBeTruthy();
      }
    }
  });

  it("caps the brief's five failures", () => {
    const checks = parseHardChecks(rubric);
    const cap = (id: string) => checks.find((c) => c.id === id)?.cap;
    expect(cap("severalQuestions")).toBe(2);
    expect(checks.find((c) => c.id === "severalQuestions")?.counted).toBe(true);
    expect(cap("acceptedVagueAnswer")).toBe(2);
    expect(cap("validatedWrongAnswer")).toBe(1);
    expect(cap("wroteTheDefense")).toBe(1);
    expect(cap("gaveGrade")).toBe(2);
  });
});
