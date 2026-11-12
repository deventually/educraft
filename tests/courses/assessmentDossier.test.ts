import { describe, expect, it } from "vitest";
import { assessmentDossierDoc, type DossierAnalysis } from "~/lib/courses/assessmentDossier";
import type { CourseData } from "~/lib/courses/types";
import { documentedCourse, itemizedCourse, LO1, LO2, TEST1 } from "./fixtures";

const course = (data: CourseData = documentedCourse()) => ({ name: "Databases", data });
const analysis: DossierAnalysis = {
  numbers: "| Vraag | p |\n| --- | --- |\n| V1 | 0,82 |",
  explanation: "Vraag 3 was te moeilijk.",
  createdAt: new Date("2026-11-10T10:00:00Z"),
};
const md = (data?: CourseData, locale: "nl" | "en" = "nl", a?: DossierAnalysis) =>
  assessmentDossierDoc(course(data), TEST1, locale, a)!.sections[0]!.markdown;

/** A summative test with nothing filled in: no details, no outcomes, no parts. */
function bareCourse(): CourseData {
  const d = documentedCourse();
  d.assessments[1] = { id: TEST1, title: "Eindopdracht", kind: "summative", coverage: [] };
  return d;
}

describe("assessmentDossierDoc: the test dossier in one document", () => {
  it("is a document named after the course and the test", () => {
    const doc = assessmentDossierDoc(course(), TEST1, "nl", analysis)!;
    expect(doc.title).toBe("Databases: toetsdossier Eindopdracht");
    expect(doc.sections).toHaveLength(1);
  });

  it("holds the details, the blueprint, the marking model, pass mark and resit, alignment and analysis", () => {
    const m = md(undefined, "nl", analysis);
    expect(m).toContain("| Module | Databases (DB1) |");
    expect(m).toContain("## Toetsmatrijs");
    expect(m).toContain("### Leeruitkomsten en onderdelen");
    expect(m).toContain("## Beoordelingsmodel");
    expect(m).toContain("### Onderdeel 1: Datamodel");
    expect(m).toContain("## Cesuur en herkansing");
    expect(m).toContain("Cesuur: 75%");
    expect(m).toContain("In week 10, met een vervangende opdracht.");
    expect(m).toContain("## Samenhang");
    expect(m).toContain("## Toetsanalyse");
    expect(m).toContain("| V1 | 0,82 |");
    expect(m).toContain("Vraag 3 was te moeilijk.");
    expect(m).toContain("10 nov 2026");
    // The details table comes once, not once per part document.
    expect(m.match(/\| Module \|/g)).toHaveLength(1);
  });

  it("opens with what is still to do, or says that nothing is", () => {
    const full = md(undefined, "nl", analysis);
    expect(full.indexOf("## Nog te doen")).toBe(0);
    expect(full).toContain("Alles staat erin.");
    const noAnalysis = md();
    expect(noAnalysis).toContain("Nog geen toetsanalyse gekoppeld");
    expect(noAnalysis).toContain("*Toetsanalyse uitleggen*");
    expect(noAnalysis).not.toContain("## Toetsanalyse");
  });

  it("with nothing filled in, lists only what is to do", () => {
    const m = md(bareCourse());
    expect(m).toContain("## Nog te doen");
    expect(m).toContain("- Nog geen cesuur.");
    expect(m).toContain("- Nog geen beoordelingsmodel: voeg onderdelen toe aan de toets.");
    expect(m).toContain("- Deze toets toetst nog geen leeruitkomst.");
    expect(m).toContain("- Nog geen toetsanalyse gekoppeld");
    for (const h of ["Toetsmatrijs", "Beoordelingsmodel", "Cesuur en herkansing", "Toetsanalyse"])
      expect(m).not.toContain(`## ${h}`);
  });

  it("names an outcome the test assesses without a question", () => {
    const d = itemizedCourse();
    d.assessments[1]!.items = d.assessments[1]!.items!.filter((i) => i.outcomeId === LO1);
    d.assessments[1]!.coverage = [{ outcomeId: LO1 }, { outcomeId: LO2 }];
    expect(md(d)).toContain("- LU2 heeft nog geen vraag.");
  });

  it("states the alignment findings of this test as facts", () => {
    const d = itemizedCourse();
    d.assessments[1]!.items = d.assessments[1]!.items!.slice(0, 3);
    const m = md(d);
    expect(m).toContain("## Samenhang");
    expect(m).toMatch(/Let op: .*LU2/);
  });

  it("speaks English", () => {
    const m = md(bareCourse(), "en");
    expect(m).toContain("## Still to do");
    expect(m).toContain("- No pass mark yet.");
    expect(assessmentDossierDoc(course(), TEST1, "en")!.title).toBe(
      "Databases: test dossier Eindopdracht",
    );
  });

  it("is null for a test that is not in the course", () => {
    expect(assessmentDossierDoc(course(), "gone", "nl")).toBeNull();
  });
});
