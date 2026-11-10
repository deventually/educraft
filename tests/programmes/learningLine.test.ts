import { describe, expect, it } from "vitest";
import { learningLineOverview } from "~/lib/programmes/learningLine";
import type { BloomLevel, LearningOutcome } from "~/lib/courses/types";

const lo = (
  id: string,
  text: string,
  bloom?: BloomLevel,
  packTags?: LearningOutcome["packTags"],
) => ({
  id,
  text,
  ...(bloom && { bloom }),
  ...(packTags && { packTags }),
});

const course = (id: string, outcomes: LearningOutcome[]) => ({
  id,
  name: `Cursus ${id}`,
  outcomes,
});

describe("learningLineOverview (pure, advisory, no AI)", () => {
  it("keeps the courses in the order of the line, each with its outcomes", () => {
    const o = learningLineOverview([
      course("b", [lo("1", "Je schrijft code.", "apply")]),
      course("a", [lo("2", "Je test code.")]),
    ]);
    expect(o.columns.map((c) => c.courseId)).toEqual(["b", "a"]);
    expect(o.columns[0]?.outcomes).toEqual([
      { id: "1", text: "Je schrijft code.", bloom: "apply" },
    ]);
  });

  it("finds an outcome that comes back by the same text, ignoring case, spaces and the full stop", () => {
    const o = learningLineOverview([
      course("p1", [lo("1", "Je schrijft  code.", "apply")]),
      course("p2", [lo("2", "je schrijft code", "analyze")]),
      course("p3", [lo("3", "Iets anders.", "create")]),
    ]);
    expect(o.threads).toEqual([
      {
        key: "text:je schrijft code",
        label: { kind: "text", text: "Je schrijft  code." },
        cells: [
          { outcomeIds: ["1"], bloom: "apply" },
          { outcomeIds: ["2"], bloom: "analyze" },
          null,
        ],
        drops: false,
      },
    ]);
  });

  it("finds a theme that comes back by the same pack tag, with the highest Bloom per course", () => {
    const tag = { beroepstaak: "Realiseren" };
    const o = learningLineOverview([
      course("p1", [lo("1", "A", "apply", tag), lo("2", "B", "understand", tag)]),
      course("p2", [lo("3", "C", "evaluate", { beroepstaak: ["Realiseren", "Ontwerpen"] })]),
    ]);
    expect(o.threads).toEqual([
      {
        key: "tag:beroepstaak=Realiseren",
        label: { kind: "tag", field: "beroepstaak", value: "Realiseren" },
        cells: [
          { outcomeIds: ["1", "2"], bloom: "apply" },
          { outcomeIds: ["3"], bloom: "evaluate" },
        ],
        drops: false,
      },
    ]);
  });

  it("flags a thread whose Bloom level drops in a later course", () => {
    const o = learningLineOverview([
      course("p1", [lo("1", "Je ontwerpt een datamodel.", "create")]),
      course("p2", [lo("2", "Je ontwerpt een datamodel.")]),
      course("p3", [lo("3", "Je ontwerpt een datamodel.", "apply")]),
    ]);
    expect(o.threads[0]?.drops).toBe(true);
  });

  it("has no threads when nothing comes back, and ignores a number tag (a level, not a theme)", () => {
    const o = learningLineOverview([
      course("p1", [lo("1", "A", "apply", { niveau: 2 })]),
      course("p2", [lo("2", "B", "apply", { niveau: 2 })]),
    ]);
    expect(o.threads).toEqual([]);
  });
});
