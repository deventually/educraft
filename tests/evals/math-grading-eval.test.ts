import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(__dirname, "../../evals/math-grading");
const cases = JSON.parse(readFileSync(join(dir, "cases.json"), "utf8")).cases as {
  id: string;
  description: string;
  imagePath?: string;
}[];

/** Without the photo the vision eval skips this tool, so the fixture is part of the eval. */
describe("math-grading eval has a real handwritten photo", () => {
  it("every case's image fixture exists and stays under the vision API size limit", () => {
    for (const c of cases) {
      expect(c.imagePath, c.id).toBeDefined();
      const abs = join(dir, c.imagePath as string);
      expect(existsSync(abs), `${c.id}: ${abs}`).toBe(true);
      expect(statSync(abs).size, c.id).toBeLessThan(3.5 * 1024 * 1024);
    }
  });

  it("tells the judge the ground truth: the known slip 4 · 6 = 18 and the correct 24x", () => {
    const c = cases.find((x) => x.id === "derivative-eqf4");
    expect(c?.description).toMatch(/18x/);
    expect(c?.description).toMatch(/24x/);
  });
});
