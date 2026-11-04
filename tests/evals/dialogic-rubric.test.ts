import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseHardChecks } from "../../scripts/eval-helpers";

const dir = join(__dirname, "../../evals/dialogic-encounters");
const rubric = readFileSync(join(dir, "rubric.md"), "utf8");
const cases = JSON.parse(readFileSync(join(dir, "cases.json"), "utf8")).cases as {
  id: string;
  values: { theorist: string };
  userTurns: string[];
}[];

describe("dialogic-encounters eval follows the book (Clark-Stallkamp et al.)", () => {
  it("no longer rewards bouncing the question back: the theorist answers the interview", () => {
    expect(rubric).not.toMatch(/turning the question back/i);
    expect(rubric).toMatch(/answers? the (teacher's )?(interview )?questions?/i);
  });

  it("defines the book's failure modes as hard checks", () => {
    const ids = parseHardChecks(rubric).map((c) => c.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "acceptedFlawedPremise",
        "driftedTheory",
        "anachronism",
        "inventedSources",
        "brokeCharacter",
        "longTurn",
      ]),
    );
    expect(parseHardChecks(rubric).find((c) => c.id === "longTurn")?.counted).toBe(true);
  });

  it("tests premise correction with the book's own counter-examples (p. 89)", () => {
    const turns = cases.flatMap((c) => c.userTurns).join("\n");
    expect(cases.some((c) => c.values.theorist === "Jean Piaget")).toBe(true);
    expect(turns).toMatch(/beloning/i); // Piaget + operant reinforcement
    expect(turns).toMatch(/alleen|zelf ontdekken/i); // Vygotsky + individual discovery
  });

  it("asks about a technology from after the theorist's lifetime (p. 96)", () => {
    expect(cases.flatMap((c) => c.userTurns).join("\n")).toMatch(/ChatGPT|AI|app/);
  });

  it("includes the book's step 3: stop the interview and run a CRAAP test", () => {
    expect(cases.flatMap((c) => c.userTurns).join("\n")).toMatch(/CRAAP/);
  });
});
