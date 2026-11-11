import { describe, expect, it } from "vitest";
import { markingModelDoc } from "~/lib/courses/markingModel";
import { alignedCourse, documentedCourse, TEST1 } from "./fixtures";

const course = (data = documentedCourse()) => ({ name: "Databases", data });
const md = (locale: "nl" | "en" = "nl") =>
  markingModelDoc(course(), TEST1, locale)!.sections[0]!.markdown;

describe("markingModelDoc: the marking model of a test with parts", () => {
  it("is a document named after the course and the test", () => {
    const doc = markingModelDoc(course(), TEST1, "nl")!;
    expect(doc.title).toBe("Databases: nakijkmodel Eindopdracht");
    expect(doc.sections[0]!.kind).toBe("rubric");
  });

  it("opens with the details, the conditions, the knock-outs and the pass mark", () => {
    const m = md();
    expect(m).toContain("| Module | Databases (DB1) |");
    expect(m).toContain("| Opgesteld door | Docent A |");
    expect(m).toContain("| Cesuur | 75% |");
    expect(m).toContain("- Alle opdrachten ingeleverd.");
    expect(m).toContain("Voorwaardelijk (knock-out): Datamodel.");
  });

  it("gives every part its outcomes, weight and a fail and pass column", () => {
    const m = md();
    expect(m).toContain("### Onderdeel 1: Datamodel");
    expect(m).toContain(
      "Leeruitkomsten: LU1 · weging 60% · knock-out: zonder voldoende hier is de toets onvoldoende",
    );
    expect(m).toContain("| Onvoldoende | Voldoende |");
    expect(m).toContain(
      "| De student voldoet niet aan de criteria bij voldoende. | Het model werkt. · De keuzes zijn onderbouwd. |",
    );
    expect(m).toContain("### Onderdeel 2: Toelichting");
    expect(m).toContain("Leeruitkomsten: LU1, LU2 · weging 40%");
    expect(m).toContain("| Legt normaliseren niet of onjuist uit. | Legt normaliseren uit. |");
    expect(m).toContain("- **LU2** Je legt normaliseren uit.");
  });

  it("speaks English", () => {
    expect(md("en")).toContain("### Part 1: Datamodel");
    expect(md("en")).toContain("| Fail | Pass |");
  });

  it("is null without parts, or for a test that is not in the course", () => {
    expect(markingModelDoc(course(alignedCourse()), TEST1, "nl")).toBeNull();
    expect(markingModelDoc(course(), "gone", "nl")).toBeNull();
  });
});
