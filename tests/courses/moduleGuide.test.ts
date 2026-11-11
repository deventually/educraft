import { describe, expect, it } from "vitest";
import { moduleGuideDoc } from "~/lib/courses/moduleGuide";
import { emptyCourseData } from "~/lib/courses/schema";
import { documentedCourse } from "./fixtures";

const course = () => {
  const data = documentedCourse();
  Object.assign(data, {
    ec: 5,
    phase: "Propedeuse, semester 1",
    leader: "Docent A",
    examiners: "Docenten Informatica",
    description: "In deze module ontwerp je databases.\n\nJe werkt in een team.",
  });
  return { name: "Databases", data };
};
const md = (locale: "nl" | "en" = "nl") => moduleGuideDoc(course(), locale).sections[0]!.markdown;

describe("moduleGuideDoc: the module guide (modulewijzer) from the course", () => {
  it("is a document named after the course", () => {
    const doc = moduleGuideDoc(course(), "nl");
    expect(doc.title).toBe("Databases: modulewijzer");
    expect(doc.sections).toHaveLength(1);
  });

  it("opens with the module details", () => {
    const m = md();
    expect(m).toContain("| Modulenaam | Databases |");
    expect(m).toContain("| Modulecode | DB1 |");
    expect(m).toContain("| Studiepunten | 5 EC |");
    expect(m).toContain("| Studiejaar | 2026-2027 |");
    expect(m).toContain("| Studiefase | Propedeuse, semester 1 |");
    expect(m).toContain("| Moduleleider | Docent A |");
  });

  it("lists every learning outcome with its success criteria", () => {
    const m = md();
    expect(m).toContain("### Leeruitkomsten en succescriteria");
    expect(m).toContain("**LU1** Je ontwerpt een datamodel.");
    expect(m).toContain(
      "- S-An 1.1 De student registreert requirements.\n- Het model is genormaliseerd.",
    );
    expect(m).toContain("**LU2** Je legt normaliseren uit.");
  });

  it("keeps the description's paragraphs", () => {
    expect(md()).toContain(
      "### Inhoudelijke beschrijving\n\nIn deze module ontwerp je databases.\n\nJe werkt in een team.",
    );
  });

  it("sums up the assessment: each test, the examiners, conditions and resit", () => {
    const m = md();
    expect(m).toContain("### Beoordeling");
    expect(m).toContain("| Toets | Toetsvorm | Soort | Week | Weging | Cesuur |");
    expect(m).toContain("| Oefentoets |  | Formatief | 2 |  |  |");
    expect(m).toContain("| Eindopdracht | Andere wijze | Summatief | 4 | 100% | 75% |");
    expect(m).toContain("| Examinator(en) | Docenten Informatica |");
    expect(m).toContain("#### Eindopdracht");
    expect(m).toContain("- Alle opdrachten ingeleverd.");
    expect(m).toContain("Herkansing: In week 10, met een vervangende opdracht.");
  });

  it("speaks English", () => {
    expect(md("en")).toContain("| Module name | Databases |");
    expect(md("en")).toContain("### Learning outcomes and success criteria");
  });

  it("shows only what is filled in, also for an empty course", () => {
    const m = moduleGuideDoc({ name: "Leeg", data: emptyCourseData() }, "nl").sections[0]!.markdown;
    expect(m).toContain("| Modulenaam | Leeg |");
    expect(m).not.toContain("Modulecode");
    expect(m).not.toContain("Inhoudelijke beschrijving");
    expect(m).not.toContain("### Beoordeling");
  });
});
