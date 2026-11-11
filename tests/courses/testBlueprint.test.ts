import { describe, expect, it } from "vitest";
import { bloomGrid } from "~/lib/courses/items";
import { testBlueprintDoc } from "~/lib/courses/testBlueprint";
import { courseAsEvidence } from "~/lib/courses/evidence";
import { documentedCourse, itemizedCourse, LO1, LO2, TEST1 } from "./fixtures";

const course = (data = documentedCourse()) => ({ name: "Databases | jaar 1", data });
const test1 = (data: ReturnType<typeof itemizedCourse>) =>
  data.assessments.find((a) => a.id === TEST1)!;
const md = (data = documentedCourse(), locale: "nl" | "en" = "nl") =>
  testBlueprintDoc(course(data), TEST1, locale)!.sections[0]!.markdown;

describe("bloomGrid: points per outcome and cognitive level", () => {
  it("has one column per level used, in Bloom order, and adds up both ways", () => {
    const g = bloomGrid(test1(itemizedCourse()));
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

describe("testBlueprintDoc: the blueprint per learning outcome", () => {
  it("is a table document named after the course and the test", () => {
    const doc = testBlueprintDoc(course(), TEST1, "nl")!;
    expect(doc.title).toBe("Databases | jaar 1: toetsmatrijs Eindopdracht");
    expect(doc.sections).toHaveLength(1);
    expect(doc.sections[0]!.kind).toBe("table");
  });

  it("opens with the details of the module and the test", () => {
    const m = md();
    expect(m).toContain("| Module | Databases \\| jaar 1 (DB1) |");
    expect(m).toContain("| Studiejaar | 2026-2027 |");
    expect(m).toContain("| Toets | Eindopdracht |");
    expect(m).toContain("| Toetsvorm | Andere wijze |");
    expect(m).toContain("| Soort | Summatief · week 4 · weging 100% · zonder toezicht |");
    expect(m).toContain("| Toetseigenaar | Docent A |");
    expect(m).toContain("| Beoordeling | Voldoende of onvoldoende |");
    expect(m).toContain("| Cesuur | 75% |");
  });

  it("has one row per learning outcome with criteria, level, weight and parts", () => {
    const m = md();
    expect(m).toContain(
      "| Leeruitkomst | Succescriteria | Niveau | Weging | Beoordelingscriteria | Onderdeel |",
    );
    expect(m).toContain(
      "| **LU1** Je ontwerpt een datamodel. | S-An 1.1 De student registreert requirements. · Het model is genormaliseerd. | 2 | 100% | Het model werkt. · De keuzes zijn onderbouwd. · Legt normaliseren uit. | Datamodel (60%) · Toelichting (40%) |",
    );
    expect(m).toContain(
      "| **LU2** Je legt normaliseren uit. |  | analyseren | 40% | Legt normaliseren uit. | Toelichting (40%) |",
    );
    expect(m).toContain("| **Totaal** |  |  | 100% |  |  |");
    expect(m).toContain("Een onderdeel bij meer leeruitkomsten telt bij elk daarvan mee.");
  });

  it("ends with the conditions, how the test is taken and the resit", () => {
    const m = md();
    expect(m).toContain(
      "### Voorwaarden voor een voldoende\n\n- Alle opdrachten ingeleverd.\n- Deelgenomen aan het gesprek.",
    );
    expect(m).toContain("### Afname\n\nThuis gemaakt, AI mag met bronvermelding.");
    expect(m).toContain("### Herkansing\n\nIn week 10, met een vervangende opdracht.");
  });

  it("speaks English", () => {
    const m = md(documentedCourse(), "en");
    expect(m).toContain("| Assessment | Pass or fail |");
    expect(m).toContain("### Conditions for a pass");
    expect(m).toContain("| Learning outcome | Success criteria |");
  });

  it("leaves out what is not filled in", () => {
    const m = md(itemizedCourse());
    for (const label of ["Toetsvorm", "Toetseigenaar", "Cesuur", "Voorwaarden", "Herkansing"])
      expect(m).not.toContain(label);
  });

  it("for a written test takes the weight from the questions and adds the specification", () => {
    const m = md(itemizedCourse());
    expect(m).toContain("| **LU1** Je ontwerpt een datamodel. |  | creëren | 80% |  |  |");
    expect(m).toContain("### Specificatie per vraag");
    expect(m).toContain("#### Punten per leeruitkomst en denkniveau");
    expect(m).toContain("| Leeruitkomst | begrijpen | analyseren | creëren | Totaal |");
    expect(m).toContain("| 3 | LU2 | analyseren | Meerkeuze | 2 |");
  });

  it("is null for a test that is not in the course", () => {
    expect(testBlueprintDoc(course(), "gone", "nl")).toBeNull();
  });

  it("leaves the BDB/BKE snapshot as it was", () => {
    const m = courseAsEvidence(course(itemizedCourse()), { assessmentId: TEST1 }, "nl") ?? "";
    expect(m).toContain("## Databases | jaar 1: Eindopdracht");
    expect(m).toContain("### Toetsmatrijs");
    expect(m).not.toContain("denkniveau |");
  });
});
