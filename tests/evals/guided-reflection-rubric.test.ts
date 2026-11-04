import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseHardChecks } from "../../scripts/eval-helpers";

const dir = join(__dirname, "../../evals/guided-reflection");
const rubric = readFileSync(join(dir, "rubric.md"), "utf8");
const cases = JSON.parse(readFileSync(join(dir, "cases.json"), "utf8")).cases as {
  id: string;
  values: Record<string, string>;
}[];

describe("guided-reflection eval follows the book (Benedict & Thayer)", () => {
  it("judges the three stages of Wiggins & McTighe as separate parts", () => {
    expect(rubric).toMatch(/three stages/i);
    expect(rubric).toMatch(/p\. 74/);
  });

  it("defines the book's failure modes as hard checks", () => {
    const ids = parseHardChecks(rubric).map((c) => c.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "inventedOutcomes",
        "blurredStages",
        "unalignedItem",
        "inventedSources",
      ]),
    );
  });

  it("rewards stopping to sharpen vague core input instead of designing on own proposals", () => {
    expect(rubric).toMatch(/stops? after naming what to sharpen/i);
  });

  it("has a case with vague teacher input, where the tool must not fill the gap itself", () => {
    expect(cases.some((c) => /vague/.test(c.id))).toBe(true);
  });

  it("has a case that says what worked or did not work before (book step 2)", () => {
    expect(cases.some((c) => (c.values.eerdereErvaring ?? "").length > 0)).toBe(true);
  });
});
