import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { questionPlan } from "~/lib/courses/questionPlan";

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

/**
 * Meting t and u: the questions stage itself had to work out which row each question
 * belongs to, and left correction traces in the answer-model headings ("Let op: dit
 * kopje is bedoeld als Rij R2…") and sometimes wrote three options. Two rounds of prompt
 * text did not help. The fixed plan is computed in code from the blueprint table: one
 * line per question, numbered in blueprint order, with row, level, type and points.
 */
describe("questionPlan", () => {
  it("gives every question its own line with row, level, type and points (nl)", () => {
    const plan = questionPlan(fixture("blueprint-nl.md"), "nl");
    const lines = plan.split("\n").filter((l) => l.startsWith("- "));
    expect(lines).toHaveLength(12);
    expect(lines[0]).toBe(
      "- Vraag 1 (1 pt): Rij R1, toepassen, meerkeuze met vier opties (A tot en met D)",
    );
    expect(lines[3]).toBe(
      "- Vraag 4 (1 pt): Rij R1, toepassen, meerkeuze met vier opties (A tot en met D)",
    );
    expect(lines[4]).toBe("- Vraag 5 (3 pt): Rij R2, toepassen, open vraag");
    expect(lines[6]).toBe(
      "- Vraag 7 (1 pt): Rij R3, begrijpen, meerkeuze met vier opties (A tot en met D)",
    );
    expect(lines[11]).toBe("- Vraag 12 (2 pt): Rij R4, evalueren, open vraag");
  });

  it("states the totals, so the plan can be checked at a glance (nl)", () => {
    expect(questionPlan(fixture("blueprint-nl.md"), "nl")).toContain(
      "Totaal: 12 vragen, 20 punten.",
    );
  });

  it("writes the plan in English for an English test", () => {
    const plan = questionPlan(fixture("blueprint-nl.md"), "en");
    expect(plan).toContain(
      "- Question 1 (1 pt): Row R1, apply, multiple choice with four options (A to D)",
    );
    expect(plan).toContain("- Question 5 (3 pt): Row R2, apply, open question");
    expect(plan).toContain("Total: 12 questions, 20 points.");
  });

  it("reads an English blueprint table too", () => {
    const lines = questionPlan(fixture("blueprint-en.md"), "en")
      .split("\n")
      .filter((l) => l.startsWith("- "));
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toBe(
      "- Question 1 (1.5 pt): Row R1, apply, multiple choice with four options (A to D)",
    );
    // A Dutch plan writes a decimal comma.
    expect(questionPlan(fixture("blueprint-en.md"), "nl")).toContain("- Vraag 1 (1,5 pt): Rij R1");
  });

  it("guesses nothing: an unknown level, type or points says to follow the blueprint", () => {
    const md = [
      "| Rij | Leeruitkomst | Denkniveau | Vraagvorm | Aantal vragen | Punten per vraag | Punten |",
      "| --- | --- | --- | --- | --- | --- | --- |",
      "| R1 | Iets | Ontwerpen | Essay | 2 | ? | ? |",
    ].join("\n");
    expect(questionPlan(md, "nl")).toContain(
      "- Vraag 1 (punten volgens de matrijs): Rij R1, denkniveau volgens de matrijs, vraagvorm volgens de matrijs",
    );
  });

  it("without a readable table it says so, and leaves the blueprint in charge", () => {
    const plan = questionPlan("## Niet opgenomen\n\nGeen leeruitkomst over.", "nl");
    expect(plan).not.toMatch(/^- Vraag/m);
    expect(plan).toContain("Geen vaste indeling");
    expect(questionPlan("no table", "en")).toContain("No fixed plan");
  });
});
