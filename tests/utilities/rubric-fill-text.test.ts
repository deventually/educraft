import { describe, it, expect } from "vitest";
import { messages } from "~/lib/i18n";
import { batchToTsv, outcomeText, resultLabel } from "~/components/utilities/rubricFillText";
import { scoreRubric } from "~/lib/utilities/rubric";
import { addStudent, newBatch, setLevel, updateStudent } from "~/lib/privacy/localNames";
import { sampleRubric } from "./fixtures";
import type { RubricData } from "~/lib/utilities/rubric";

const f = messages.nl.utilities.rubric.fill;
const codeLabel = (n: number) => `Student ${n}`;

/** Pick level `i` (by position) for every criterion: [2, 1] → Analyse "Goed", Bronnen "Aanwezig". */
function pick(data: RubricData, positions: number[]): Record<string, string> {
  return Object.fromEntries(data.criteria.map((c, i) => [c.id, c.levels[positions[i]!]!.id]));
}

function filled() {
  const data = sampleRubric();
  let batch = addStudent(newBatch("r1"), "Sam");
  for (const [criterionId, levelId] of Object.entries(pick(data, [2, 1]))) {
    batch = setLevel(batch, 1, criterionId, levelId);
  }
  batch = updateStudent(batch, 1, { comment: "Goed\twerk\nvolgende keer" });
  batch = addStudent(batch, "");
  return { data, batch };
}

describe("rubric fill text", () => {
  it("names the result of an incomplete, failed and passed fill-in", () => {
    const { data, batch } = filled();
    expect(resultLabel(scoreRubric(data, batch.students[0]!.levels), f)).toBe(f.passed);
    expect(resultLabel(scoreRubric(data, batch.students[1]!.levels), f)).toBe(f.incomplete);
  });

  it("names a failed knock-out apart in the outcome line", () => {
    const data = sampleRubric();
    const o = scoreRubric(data, pick(data, [2, 0]));
    expect(outcomeText(o, f, 1, "nl").result).toBe(f.knockoutFailed);
    expect(resultLabel(o, f)).toBe(f.failed);
  });

  it("writes the overview as tab-separated rows, one cell per column", () => {
    const { data, batch } = filled();
    const [header, sam, empty] = batchToTsv(data, batch, f, codeLabel, "nl").split("\n");
    expect(header!.split("\t")).toEqual([
      f.columns.student,
      "Analyse",
      "Bronnen",
      f.columns.total,
      f.columns.grade,
      f.columns.result,
      f.columns.comment,
    ]);
    const cells = sam!.split("\t");
    expect(cells[0]).toBe("Student 1 — Sam");
    expect(cells.slice(1, 3)).toEqual(["Goed", "Aanwezig"]);
    expect(cells[5]).toBe(f.passed);
    expect(cells[6]).toBe("Goed werk volgende keer");
    expect(empty!.split("\t")[5]).toBe(f.incomplete);
  });
});
