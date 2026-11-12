import { describe, expect, it } from "vitest";
import { compareAssessors, secondAssessorMarkdown } from "~/lib/tracks/secondAssessor";
import type { RubricData } from "~/lib/utilities/rubric/schema";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const levels = (base: number) => [
  { id: id(base + 1), label: "Onvoldoende", points: 1, description: "" },
  { id: id(base + 2), label: "Voldoende", points: 2, description: "" },
  { id: id(base + 3), label: "Goed", points: 3, description: "" },
];
const RUBRIC: RubricData = {
  criteria: [
    { id: id(1), title: "Analyse", levels: levels(10) },
    { id: id(2), title: "Advies", levels: levels(20) },
  ],
};
const mine = { [id(1)]: id(12), [id(2)]: id(23) };
const theirs = { [id(1)]: id(13), [id(2)]: id(23) };

const LABELS = {
  criterion: "Criterium",
  mine: "Jij",
  theirs: "Tweede beoordelaar",
  difference: "Verschil",
  same: "gelijk",
  levels: "{n} niveau(s)",
  grades: "Cijfer volgens de rubric: jij {a}, tweede beoordelaar {b}.",
  talk: "Bespreek eerst: {criteria}.",
};

describe("compareAssessors (P38.5, on P34.1 calibrate)", () => {
  it("sets the two scores side by side per criterion, with the distance in levels", () => {
    const r = compareAssessors(RUBRIC, mine, theirs);
    expect(r).not.toBeNull();
    expect(r?.criteria).toEqual([
      { id: id(1), title: "Analyse", mine: "Voldoende", theirs: "Goed", distance: 1 },
      { id: id(2), title: "Advies", mine: "Goed", theirs: "Goed", distance: 0 },
    ]);
    expect(r?.gradeA).not.toBeNull();
    expect(r?.gradeB).toBeGreaterThan(r?.gradeA ?? 99);
  });

  it("is null while either score misses a criterion", () => {
    expect(compareAssessors(RUBRIC, { [id(1)]: id(12) }, theirs)).toBeNull();
    expect(compareAssessors(RUBRIC, mine, {})).toBeNull();
  });

  it("writes the outcome as a table, the grades and what to talk about first", () => {
    const md = secondAssessorMarkdown(compareAssessors(RUBRIC, mine, theirs)!, LABELS, "nl");
    expect(md).toContain("| Criterium | Jij | Tweede beoordelaar | Verschil |");
    expect(md).toContain("| Analyse | Voldoende | Goed | 1 niveau(s) |");
    expect(md).toContain("| Advies | Goed | Goed | gelijk |");
    expect(md).toMatch(/Cijfer volgens de rubric: jij \d/);
    expect(md).toContain("Bespreek eerst: Analyse.");
  });

  it("escapes a backslash and a pipe in a title, so the table keeps its columns", () => {
    const r = {
      criteria: [{ id: "c", title: "A\\|B", mine: "x", theirs: "x", distance: 0 }],
      gradeA: null,
      gradeB: null,
    };
    expect(secondAssessorMarkdown(r, LABELS, "nl")).toContain("| A\\\\\\|B | x | x | gelijk |");
  });
});
