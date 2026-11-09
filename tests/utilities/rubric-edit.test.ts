import { describe, it, expect } from "vitest";
import {
  addCriterion,
  addLevel,
  moveCriterion,
  moveLevel,
  newCriterion,
  newRubricData,
  removeCriterion,
  removeLevel,
  RubricDataSchema,
  updateCriterion,
  updateLevel,
} from "~/lib/utilities/rubric";
import { sampleRubric } from "./fixtures";

/** Run an edit and check the input is untouched (deep-frozen) and the output is valid. */
function immutably<T>(edit: (d: ReturnType<typeof sampleRubric>) => T) {
  const before = sampleRubric();
  const snapshot = structuredClone(before);
  const after = edit(deepFreeze(before));
  expect(before).toEqual(snapshot);
  return { before, after };
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object") {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

const LEVELS = [
  { label: "Onvoldoende", points: 0 },
  { label: "Voldoende", points: 1 },
  { label: "Goed", points: 2 },
];

describe("rubric edits", () => {
  it("starts a new rubric with one criterion and three levels", () => {
    const d = newRubricData("Criterium 1", LEVELS);
    expect(RubricDataSchema.parse(d)).toEqual(d);
    expect(d.criteria).toHaveLength(1);
    expect(d.criteria[0]!.levels.map((l) => l.label)).toEqual(["Onvoldoende", "Voldoende", "Goed"]);
  });

  it("adds a criterion at the end", () => {
    const { after } = immutably((d) => addCriterion(d, newCriterion("Nieuw", LEVELS)));
    expect(after.criteria.map((c) => c.title)).toEqual(["Analyse", "Bronnen", "Nieuw"]);
    expect(RubricDataSchema.safeParse(after).success).toBe(true);
  });

  it("does not add a 31st criterion", () => {
    let d = newRubricData("C", LEVELS);
    for (let i = 0; i < 40; i++) d = addCriterion(d, newCriterion("C", LEVELS));
    expect(d.criteria).toHaveLength(30);
  });

  it("updates a criterion", () => {
    const { before, after } = immutably((d) =>
      updateCriterion(d, d.criteria[0]!.id, { title: "Analyseren", knockout: true }),
    );
    expect(after.criteria[0]).toMatchObject({ title: "Analyseren", knockout: true });
    expect(after.criteria[1]).toBe(before.criteria[1]);
  });

  it("removes a criterion, but never the last one", () => {
    const { after } = immutably((d) => removeCriterion(d, d.criteria[0]!.id));
    expect(after.criteria.map((c) => c.title)).toEqual(["Bronnen"]);
    expect(removeCriterion(after, after.criteria[0]!.id).criteria).toHaveLength(1);
  });

  it("moves a criterion up and down, and stops at the ends", () => {
    const { after } = immutably((d) => moveCriterion(d, d.criteria[1]!.id, -1));
    expect(after.criteria.map((c) => c.title)).toEqual(["Bronnen", "Analyse"]);
    expect(moveCriterion(after, after.criteria[0]!.id, -1)).toEqual(after);
  });

  it("adds a level, up to six", () => {
    const { after } = immutably((d) => addLevel(d, d.criteria[1]!.id, "Sterk"));
    expect(after.criteria[1]!.levels.map((l) => l.label)).toEqual([
      "Ontbreekt",
      "Aanwezig",
      "Sterk",
    ]);
    // The new level is worth one point more than the highest so far.
    expect(after.criteria[1]!.levels[2]!.points).toBe(2);
    let d = after;
    for (let i = 0; i < 10; i++) d = addLevel(d, d.criteria[1]!.id, "x");
    expect(d.criteria[1]!.levels).toHaveLength(6);
  });

  it("updates a level", () => {
    const { after } = immutably((d) =>
      updateLevel(d, d.criteria[0]!.id, d.criteria[0]!.levels[1]!.id, { points: 3, label: "Ruim" }),
    );
    expect(after.criteria[0]!.levels[1]).toMatchObject({ points: 3, label: "Ruim" });
  });

  it("removes a level, but keeps at least two", () => {
    const { after } = immutably((d) =>
      removeLevel(d, d.criteria[0]!.id, d.criteria[0]!.levels[0]!.id),
    );
    expect(after.criteria[0]!.levels.map((l) => l.label)).toEqual(["Voldoende", "Goed"]);
    expect(removeLevel(after, after.criteria[0]!.id, after.criteria[0]!.levels[0]!.id)).toEqual(
      after,
    );
  });

  it("moves a level", () => {
    const { after } = immutably((d) =>
      moveLevel(d, d.criteria[0]!.id, d.criteria[0]!.levels[0]!.id, 1),
    );
    expect(after.criteria[0]!.levels.map((l) => l.label)).toEqual([
      "Voldoende",
      "Onvoldoende",
      "Goed",
    ]);
  });

  it("gives every new item a fresh UUID", () => {
    const a = newCriterion("A", LEVELS);
    const b = newCriterion("B", LEVELS);
    expect(a.id).not.toBe(b.id);
    expect(a.levels[0]!.id).not.toBe(b.levels[0]!.id);
  });
});
