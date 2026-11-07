import { describe, expect, it } from "vitest";
import {
  ENGAGEMENT_PRINCIPLES,
  engagementIndex,
  engagementSummary,
  parseEngagementLevels,
} from "~/lib/utilities/engagement";

/**
 * P31.3 — the leercheck. The AI picks a level (0–3) per principle of the book's
 * Appendix G rubric; the total and percentage are computed here, never by the AI.
 */
const NL_TABLE = `## Score per principe

| Principe | Niveau | Waarom |
| --- | --- | --- |
| Ophalen uit het geheugen (Retrieval Practice) | Laag (1) | Studenten mogen hun aantekeningen gebruiken. |
| Gespreid oefenen (Spaced Practice) | Afwezig (0) | Eén sessie. |
| Afwisselen (Interleaving) | Afwezig (0) | Lineaire opbouw. |
| Woord en beeld (Dual Coding) | Hoog (3) | De proef is visueel. |
| Concrete voorbeelden (Concrete Examples) | Hoog (3) | De proef zelf. |
| Uitleggen en verbinden (Elaboration) | Middel (2) | Formulier met vaste kopjes. |
`;

const EN_TABLE = `| Principle | Level | Why |
|---|---|---|
| Retrieval Practice | High (3) | Recall from memory. |
| Spaced Practice | Medium (2) | Second session. |
| Interleaving | Absent (0) | One experiment. |
| Dual Coding | Medium (2) | Mainly verbal. |
| Concrete Examples | High (3) | Own data. |
| Elaboration | High (3) | Why-questions. |`;

describe("parseEngagementLevels", () => {
  it("knows the six principles of Appendix G, in the book's order", () => {
    expect(ENGAGEMENT_PRINCIPLES.map((p) => p.id)).toEqual([
      "retrieval",
      "spacing",
      "interleaving",
      "dual-coding",
      "concrete-examples",
      "elaboration",
    ]);
  });

  it("reads one level per principle from a Dutch table", () => {
    expect(parseEngagementLevels(NL_TABLE)).toEqual({
      retrieval: 1,
      spacing: 0,
      interleaving: 0,
      "dual-coding": 3,
      "concrete-examples": 3,
      elaboration: 2,
    });
  });

  it("reads an English table", () => {
    expect(parseEngagementLevels(EN_TABLE)?.retrieval).toBe(3);
  });

  it("returns null when a principle is missing, so nothing is guessed", () => {
    const five = NL_TABLE.split("\n")
      .filter((l) => !l.includes("Interleaving"))
      .join("\n");
    expect(parseEngagementLevels(five)).toBeNull();
  });

  it("returns null when a principle appears twice with different levels", () => {
    const twice = `${NL_TABLE}| Afwisselen (Interleaving) | Hoog (3) | Toch wel. |\n`;
    expect(parseEngagementLevels(twice)).toBeNull();
  });

  it("returns null for a level outside 0–3", () => {
    expect(
      parseEngagementLevels(NL_TABLE.replace("Hoog (3) | De proef is", "Hoog (4) | De proef is")),
    ).toBeNull();
  });

  it("ignores a principle mentioned in running text, outside the table", () => {
    const withProse = `Retrieval Practice (3) is nice.\n\n${EN_TABLE}`;
    expect(parseEngagementLevels(withProse)?.retrieval).toBe(3);
  });
});

describe("engagementIndex", () => {
  it("adds up to the book's numbers: legacy lab report 9/18 = 50%", () => {
    const levels = parseEngagementLevels(NL_TABLE)!;
    expect(engagementIndex(levels)).toEqual({ total: 9, max: 18, percent: 50 });
  });

  it("rounds the percentage: 13/18 = 72%", () => {
    expect(engagementIndex(parseEngagementLevels(EN_TABLE)!)).toEqual({
      total: 13,
      max: 18,
      percent: 72,
    });
  });
});

describe("engagementSummary (shown under the result)", () => {
  it("states the score in the output language", () => {
    expect(engagementSummary(NL_TABLE, "nl")).toBe("Leerscore: 9 van 18 punten (50%).");
    expect(engagementSummary(EN_TABLE, "en")).toBe("Engagement score: 13 of 18 points (72%).");
  });

  it("says honestly when it cannot read all six levels", () => {
    expect(engagementSummary("Geen tabel.", "nl")).toMatch(/niet alle zes/);
    expect(engagementSummary("No table.", "en")).toMatch(/not all six/);
  });
});
