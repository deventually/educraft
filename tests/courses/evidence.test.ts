import { describe, expect, it } from "vitest";
import { courseAsEvidence, evidenceTitle } from "~/lib/courses/evidence";
import { findingText } from "~/lib/courses/findingText";
import { checkAlignment } from "~/lib/courses/alignment";
import { alignedCourse, itemizedCourse, LO1, QUIZ, TEST1 } from "./fixtures";

const course = (data = itemizedCourse()) => ({
  name: "Databases | jaar 1",
  data: { ...data, ec: 5 },
});

describe("courseAsEvidence: outcomes and matrix (P26.4)", () => {
  it("lists the outcomes with Bloom, the coverage matrix and the findings (NL)", () => {
    const md = courseAsEvidence(course(), "outcomes-and-matrix", "nl");
    expect(md).toContain("## Databases | jaar 1");
    expect(md).toContain("Studielast: 5 EC.");
    expect(md).toContain("- **LU1** Je ontwerpt een datamodel. (creëren)");
    expect(md).toContain(
      "| Leeruitkomst | Les normaliseren | Opdracht datamodel | Oefentoets | Eindopdracht |",
    );
    expect(md).toContain("| LU1 | — | ✓ | — | ✓ creëren, 2 vragen |");
    expect(md).toContain("Geen aandachtspunten. Alles sluit op elkaar aan.");
    expect(md).toMatchSnapshot();
  });

  it("writes the findings as the course page does, in English too", () => {
    const d = itemizedCourse();
    d.assessments[1]!.items = d.assessments[1]!.items!.filter((i) => i.id !== "q-2");
    const md = courseAsEvidence(course(d), "outcomes-and-matrix", "en");
    expect(md).toContain("### Learning outcomes");
    expect(md).toContain(`- Attention: ${findingText(checkAlignment(d)[0]!, d, "en")}`);
    expect(md).toContain("Eindopdracht assesses LO1 with only one question.");
    expect(md).toMatchSnapshot();
  });

  it("is deterministic", () => {
    expect(courseAsEvidence(course(), "outcomes-and-matrix", "nl")).toBe(
      courseAsEvidence(course(), "outcomes-and-matrix", "nl"),
    );
  });
});

describe("courseAsEvidence: one assessment", () => {
  it("gives the question-level matrix with a total that adds up", () => {
    const md = courseAsEvidence(course(), { assessmentId: TEST1 }, "nl") ?? "";
    expect(md).toContain("## Databases | jaar 1: Eindopdracht");
    expect(md).toContain("Summatief · week 4 · weging 100%");
    expect(md).toContain("| Vraag | Leeruitkomst | Denkniveau | Vraagvorm | Punten |");
    expect(md).toContain("| 3 | LU2 | analyseren | Meerkeuze | 2 |");
    expect(md).toContain("| **Totaal** | 4 vragen |  |  | 25 |");
    expect(md).toContain("Aandeel per leeruitkomst: LU1 80% · LU2 20%.");
    const rows = md.split("\n").filter((l) => /^\| \d+ \|/.test(l));
    const points = rows.map((l) => Number(l.split("|")[5]!.trim()));
    expect(points.reduce((s, p) => s + p, 0)).toBe(25);
    expect(md).toMatchSnapshot();
  });

  it("an assessment without questions shows its coverage instead (EN)", () => {
    const md = courseAsEvidence(course(alignedCourse()), { assessmentId: QUIZ }, "en");
    expect(md).toContain("This assessment has no question-level blueprint yet.");
    expect(md).toContain("Covers: LO2 (understand).");
    expect(md).not.toContain("| Question |");
  });

  it("returns null for an assessment that does not exist", () => {
    expect(courseAsEvidence(course(), { assessmentId: "nope" }, "nl")).toBeNull();
  });
});

describe("evidenceTitle", () => {
  it("names the course and the part", () => {
    expect(evidenceTitle(course(), "outcomes-and-matrix", "nl")).toBe(
      "Databases | jaar 1: leeruitkomsten en dekkingsmatrix",
    );
    expect(evidenceTitle(course(), { assessmentId: TEST1 }, "en")).toBe(
      "Databases | jaar 1: test blueprint Eindopdracht",
    );
  });
});

describe("findingText", () => {
  it("names the discipline that serves no outcome (NL and EN)", () => {
    const d = alignedCourse();
    d.disciplines = [{ id: "hw", name: "Hardware" }];
    const [finding] = checkAlignment(d);
    expect(findingText(finding!, d, "nl")).toBe(
      "De discipline Hardware draagt aan geen enkele leeruitkomst bij. Koppel minstens één les van Hardware aan een leeruitkomst.",
    );
    expect(findingText(finding!, d, "en")).toBe(
      "The discipline Hardware contributes to no learning outcome. Link at least one Hardware lesson to a learning outcome.",
    );
  });

  it("names outcome, item and question like the course page", () => {
    const d = itemizedCourse();
    d.assessments[1]!.items![1]!.bloom = "apply";
    expect(findingText(checkAlignment(d)[0]!, d, "nl")).toBe(
      "Vraag 2 van Eindopdracht toetst LU1 onder het niveau van de leeruitkomst.",
    );
    expect(LO1).toBe("lo-1");
  });
});
