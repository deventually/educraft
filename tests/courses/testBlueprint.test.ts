import { describe, expect, it } from "vitest";
import { bloomGrid } from "~/lib/courses/items";
import { testBlueprintDoc } from "~/lib/courses/testBlueprint";
import { courseAsEvidence } from "~/lib/courses/evidence";
import { itemizedCourse, LO1, LO2, TEST1 } from "./fixtures";

const course = (data = itemizedCourse()) => ({ name: "Databases | jaar 1", data });
const test1 = (data = itemizedCourse()) => data.assessments.find((a) => a.id === TEST1)!;

describe("bloomGrid: points per outcome and cognitive level", () => {
  it("has one column per level used, in Bloom order, and adds up both ways", () => {
    const g = bloomGrid(test1());
    expect(g.levels).toEqual(["understand", "analyze", "create"]);
    expect(g.byPoints).toBe(true);
    expect(g.rows).toEqual([
      { outcomeId: LO1, cells: [0, 0, 20], total: 20 },
      { outcomeId: LO2, cells: [3, 2, 0], total: 5 },
    ]);
    expect(g.totals).toEqual({ cells: [3, 2, 20], total: 25 });
  });

  it("counts questions when no question has points, and keeps a column for no level", () => {
    const d = itemizedCourse();
    for (const i of test1(d).items!) delete i.points;
    delete test1(d).items![3]!.bloom;
    const g = bloomGrid(test1(d));
    expect(g.byPoints).toBe(false);
    expect(g.levels).toEqual(["analyze", "create", null]);
    expect(g.rows[1]).toEqual({ outcomeId: LO2, cells: [1, 0, 1], total: 2 });
    expect(g.totals.total).toBe(4);
  });
});

describe("testBlueprintDoc: one test's blueprint as a document", () => {
  it("is a table document with the grid, the questions and the outcomes (NL)", () => {
    const doc = testBlueprintDoc(course(), TEST1, "nl")!;
    expect(doc.title).toBe("Databases | jaar 1: toetsmatrijs Eindopdracht");
    expect(doc.locale).toBe("nl");
    expect(doc.sections).toHaveLength(1);
    expect(doc.sections[0]!.kind).toBe("table");
    const md = doc.sections[0]!.markdown;
    expect(md).toContain("Summatief · week 4 · weging 100%");
    expect(md).toContain("### Punten per leeruitkomst en denkniveau");
    expect(md).toContain("| Leeruitkomst | begrijpen | analyseren | creëren | Totaal |");
    expect(md).toContain("| LU1 | — | — | 20 | 20 |");
    expect(md).toContain("| LU2 | 3 | 2 | — | 5 |");
    expect(md).toContain("| **Totaal** | 3 | 2 | 20 | 25 |");
    expect(md).toContain("### Vragen");
    expect(md).toContain("| 3 | LU2 | analyseren | Meerkeuze | 2 |");
    expect(md).toContain("- **LU1** Je ontwerpt een datamodel. (creëren)");
    // A document for colleagues: no course heading of its own, no advisory findings.
    expect(md).not.toContain("## Databases");
    expect(md).not.toContain("Aandachtspunten");
  });

  it("speaks English, and says questions when there are no points", () => {
    const d = itemizedCourse();
    for (const i of test1(d).items!) delete i.points;
    const md = testBlueprintDoc(course(d), TEST1, "en")!.sections[0]!.markdown;
    expect(md).toContain("### Questions per learning outcome and cognitive level");
    expect(md).toContain("### Questions");
  });

  it("without questions it gives the coverage, and no grid", () => {
    const d = itemizedCourse();
    delete test1(d).items;
    const md = testBlueprintDoc(course(d), TEST1, "nl")!.sections[0]!.markdown;
    expect(md).toContain("Deze toets heeft nog geen toetsmatrijs per vraag.");
    expect(md).not.toContain("denkniveau |");
  });

  it("is null for a test that is not in the course", () => {
    expect(testBlueprintDoc(course(), "gone", "nl")).toBeNull();
  });

  it("leaves the BDB/BKE snapshot as it was", () => {
    const md = courseAsEvidence(course(), { assessmentId: TEST1 }, "nl") ?? "";
    expect(md).toContain("## Databases | jaar 1: Eindopdracht");
    expect(md).toContain("### Toetsmatrijs");
    expect(md).not.toContain("denkniveau |");
  });
});
