import { describe, expect, it } from "vitest";
import { workLabel } from "~/lib/tool/workLabel";

const inputs = [
  { name: "level", kind: "select" as const },
  { name: "discipline", kind: "text" as const },
  { name: "studentWork", kind: "textarea" as const, redact: true },
  { name: "learningGoal", kind: "textarea" as const },
  { name: "notes", kind: "textarea" as const },
];

describe("workLabel: what tells one saved result from another", () => {
  it("joins the first two filled text fields, in registry order", () => {
    const label = workLabel(inputs, {
      level: "hbo",
      discipline: "Biologie",
      learningGoal: "Studenten leggen fotosynthese uit",
      notes: "Niet getoond",
    });
    expect(label).toBe("Biologie · Studenten leggen fotosynthese uit");
  });

  it("skips student work, select values and empty fields", () => {
    const label = workLabel(inputs, {
      level: "hbo",
      discipline: "  ",
      studentWork: "Jan schreef dit essay",
      learningGoal: "Mitose",
    });
    expect(label).toBe("Mitose");
  });

  it("takes only the first line of a field and cuts a long one", () => {
    const long = "a".repeat(120);
    expect(workLabel(inputs, { discipline: "Eerste regel\nTweede regel" })).toBe("Eerste regel");
    const cut = workLabel(inputs, { discipline: long });
    expect(cut?.length).toBeLessThanOrEqual(60);
    expect(cut?.endsWith("…")).toBe(true);
  });

  it("falls back to the result's first heading, without markdown", () => {
    expect(workLabel(inputs, {}, "Intro\n\n## **Lesplan:** _Mitose_\n\nTekst")).toBe(
      "Lesplan: Mitose",
    );
  });

  it("is undefined when nothing tells the result apart", () => {
    expect(workLabel(inputs, {}, "Alleen tekst")).toBeUndefined();
    expect(workLabel(inputs, "not an object")).toBeUndefined();
  });
});
