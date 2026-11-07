import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseHardChecks } from "../../scripts/eval-helpers";

const read = (tool: string, file: string) =>
  readFileSync(join(__dirname, "../../evals", tool, file), "utf8");
const casesOf = (tool: string) =>
  JSON.parse(read(tool, "cases.json")).cases as { id: string; values: Record<string, string> }[];

/** BDB/BKE plan, PR 3: two fields became optional; the @v2 prompts are measured on an empty one. */
describe("evals for the optional fields", () => {
  for (const [tool, field, check] of [
    ["cognitive-architect", "legacyActivity", "inventedActivity"],
    ["contextualization", "pedagogicalApproach", "approachAsTeachers"],
  ] as const) {
    it(`${tool} has a case with ${field} empty and a hard check for it`, () => {
      expect(casesOf(tool).some((c) => c.values[field] === "")).toBe(true);
      expect(casesOf(tool).some((c) => c.values[field])).toBe(true);
      expect(parseHardChecks(read(tool, "rubric.md")).map((c) => c.id)).toContain(check);
    });
  }
});
