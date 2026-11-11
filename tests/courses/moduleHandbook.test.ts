import { describe, expect, it } from "vitest";
import { moduleHandbookDoc } from "~/lib/courses/moduleHandbook";
import { emptyCourseData } from "~/lib/courses/schema";
import { documentedCourse } from "./fixtures";

const course = () => {
  const data = documentedCourse();
  Object.assign(data, {
    ec: 5,
    leader: "Docent A",
    description: "In deze module ontwerp je databases.\n\nJe werkt in een team.",
    literature: "Boek over databases, 3e druk.\nArtikel over normaliseren.",
  });
  return { name: "Databases", data };
};
const md = (locale: "nl" | "en" = "nl") =>
  moduleHandbookDoc(course(), locale).sections[0]!.markdown;

describe("moduleHandbookDoc: the module handbook (modulehandleiding) from the course", () => {
  it("is a document named after the course, opening with the module details", () => {
    const doc = moduleHandbookDoc(course(), "nl");
    expect(doc.title).toBe("Databases: modulehandleiding");
    expect(md()).toContain("| Modulenaam | Databases |");
    expect(md()).toContain("| Moduleleider | Docent A |");
  });

  it("introduces the module with its description and general information", () => {
    const m = md();
    expect(m).toContain(
      "### Inleiding\n\nIn deze module ontwerp je databases.\n\nJe werkt in een team.",
    );
    expect(m).toContain("### Algemene informatie\n\n- Studielast: 5 EC (140 uur)\n- Duur: 4 weken");
  });

  it("lists the learning outcomes with their success criteria", () => {
    const m = md();
    expect(m).toContain("### Leeruitkomsten en succescriteria");
    expect(m).toContain(
      "**LU1** Je ontwerpt een datamodel.\n\n- S-An 1.1 De student registreert requirements.",
    );
  });

  it("plans the module per week: activities and tests with their outcomes", () => {
    const m = md();
    expect(m).toContain("### Opbouw per week");
    expect(m).toContain("| Week | Onderdeel | Soort | Leeruitkomsten |");
    expect(m).toContain("| 1 | Les normaliseren | Les | LU2 |");
    expect(m).toContain("| 2 | Opdracht datamodel | Opdracht | LU1 |");
    expect(m).toContain("| 2 | Oefentoets | Formatief | LU2 |");
    expect(m).toContain("| 4 | Eindopdracht | Summatief | LU1, LU2 |");
    expect(m.indexOf("| 1 | Les")).toBeLessThan(m.indexOf("| 4 | Eindopdracht"));
  });

  it("describes each test: details, conditions, parts and where the marking model is", () => {
    const m = md();
    expect(m).toContain("### Toetsing");
    expect(m).toContain("#### Eindopdracht");
    expect(m).toContain("- Toetsvorm: Andere wijze");
    expect(m).toContain("- Weging: 100%");
    expect(m).toContain("- Cesuur: 75%");
    expect(m).toContain("- Herkansing: In week 10, met een vervangende opdracht.");
    expect(m).toContain("- Afname: Thuis gemaakt, AI mag met bronvermelding.");
    expect(m).toContain("Voorwaarden voor een voldoende:\n\n- Alle opdrachten ingeleverd.");
    expect(m).toContain("| Onderdeel | Leeruitkomsten | Weging | Knock-out |");
    expect(m).toContain("| Datamodel | LU1 | 60% | ja |");
    expect(m).toContain("| Toelichting | LU1, LU2 | 40% | nee |");
    expect(m).toContain("De criteria per onderdeel staan in het nakijkmodel.");
    expect(m).toContain("#### Oefentoets");
  });

  it("ends with the literature, one item per line", () => {
    expect(md()).toContain(
      "### Literatuur\n\n- Boek over databases, 3e druk.\n- Artikel over normaliseren.",
    );
  });

  it("speaks English", () => {
    expect(moduleHandbookDoc(course(), "en").title).toBe("Databases: module handbook");
    expect(md("en")).toContain("### Week by week");
    expect(md("en")).toContain("| Datamodel | LO1 | 60% | yes |");
  });

  it("shows only what is filled in, also for an empty course", () => {
    const m = moduleHandbookDoc({ name: "Leeg", data: emptyCourseData() }, "nl").sections[0]!
      .markdown;
    expect(m).toContain("| Modulenaam | Leeg |");
    for (const heading of [
      "Inleiding",
      "Algemene informatie",
      "Opbouw per week",
      "Toetsing",
      "Literatuur",
    ])
      expect(m).not.toContain(heading);
  });
});
