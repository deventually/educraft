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

  it("gives every part one table: the part, a fail and a pass column, a line per criterion", () => {
    const m = md();
    expect(m).toContain("### Onderdeel 1: Datamodel");
    expect(m).toContain("| Onderdeel | Onvoldoende | Voldoende |");
    expect(m).toContain(
      "| **Datamodel**<br>Leeruitkomsten: LU1<br>Weging: 60%<br>Knock-out: ja | De student voldoet niet aan de criteria bij voldoende. | De student voldoet aan de volgende criteria:<br>Het model werkt.<br>De keuzes zijn onderbouwd. |",
    );
    expect(m).toContain("### Onderdeel 2: Toelichting");
    expect(m).toContain(
      "| **Toelichting**<br>Leeruitkomsten: LU1, LU2<br>Weging: 40%<br>Knock-out: nee | Legt normaliseren niet of onjuist uit. | De student voldoet aan de volgende criteria:<br>Legt normaliseren uit. |",
    );
    expect(m).toContain("- **LU2** Je legt normaliseren uit.");
  });

  it("speaks English", () => {
    expect(md("en")).toContain("### Part 1: Datamodel");
    expect(md("en")).toContain("| Part | Fail | Pass |");
    expect(md("en")).toContain("Knock-out: yes");
  });

  it("is null without parts, or for a test that is not in the course", () => {
    expect(markingModelDoc(course(alignedCourse()), TEST1, "nl")).toBeNull();
    expect(markingModelDoc(course(), "gone", "nl")).toBeNull();
  });
});
