import { describe, it, expect } from "vitest";
import { rubricToMarkdown, rubricToTsv } from "~/lib/utilities/rubric";
import { sampleRubric } from "./fixtures";

const labels = { criterion: "Criterium", level: "Niveau", points: "pt", knockout: "knock-out" };

describe("rubric export", () => {
  it("copies as a tab-separated table: criteria × levels", () => {
    const d = sampleRubric();
    d.criteria[0]!.levels[0]!.description = "Geen\tanalyse,\nnee.";
    const lines = rubricToTsv(d, labels).split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("Criterium\tNiveau 1\tNiveau 2\tNiveau 3");
    // Tabs and newlines in cells become spaces, so the table pastes cleanly into Excel.
    expect(lines[1]).toBe(
      "Analyse\tOnvoldoende (0 pt): Geen analyse, nee.\tVoldoende (2 pt): Een analyse.\tGoed (4 pt): Een scherpe analyse.",
    );
    // Short criteria leave trailing cells empty; knock-out is marked.
    expect(lines[2]).toBe("Bronnen (knock-out)\tOntbreekt (0 pt)\tAanwezig (1 pt): APA.\t");
  });

  it("copies as a Markdown table, escaping pipes", () => {
    const d = sampleRubric();
    d.criteria[0]!.title = "Analyse | diepgang";
    const md = rubricToMarkdown(d, labels);
    const lines = md.split("\n");
    expect(lines[0]).toBe("| Criterium | Niveau 1 | Niveau 2 | Niveau 3 |");
    expect(lines[1]).toBe("| --- | --- | --- | --- |");
    expect(lines[2]).toContain("| Analyse \\| diepgang |");
    expect(lines[2]).toContain("**Goed** (4 pt): Een scherpe analyse.");
    expect(lines[3]).toBe(
      "| Bronnen (knock-out) | **Ontbreekt** (0 pt) | **Aanwezig** (1 pt): APA. |  |",
    );
  });
});
