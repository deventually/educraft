import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type BlueprintRow,
  expandToItems,
  parseBlueprintTable,
  proposeOutcomeMapping,
} from "~/lib/courses/blueprintImport";
import { CourseDataSchema } from "~/lib/courses/schema";
import { setAssessmentItems } from "~/lib/courses/edit";
import { alignedCourse, TEST1 } from "./fixtures";

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

function rowsOf(markdown: string): BlueprintRow[] {
  const r = parseBlueprintTable(markdown);
  if ("error" in r) throw new Error(r.error);
  return r.rows;
}

describe("parseBlueprintTable (P26.2)", () => {
  it("reads the Dutch blueprint table of the test-items tool", () => {
    const r = parseBlueprintTable(fixture("blueprint-nl.md"));
    expect(r).toEqual({
      rows: [
        {
          row: "R1",
          outcomeName: "De student berekent een betrouwbaarheidsinterval voor een gemiddelde.",
          bloom: "apply",
          format: "multiple-choice",
          count: 4,
          pointsPerItem: 1,
        },
        {
          row: "R2",
          outcomeName: "De student berekent een betrouwbaarheidsinterval voor een gemiddelde.",
          bloom: "apply",
          format: "open",
          count: 2,
          pointsPerItem: 3,
        },
        {
          row: "R3",
          outcomeName: "Interpreteren van een interval",
          bloom: "understand",
          format: "multiple-choice",
          count: 2,
          pointsPerItem: 1,
        },
        {
          row: "R4",
          outcomeName: "Interpreteren van een interval",
          bloom: "evaluate",
          format: "open",
          count: 4,
          pointsPerItem: 2,
        },
      ],
      totalMismatch: false,
    });
  });

  it("reads the English table, with alignment colons and a decimal comma", () => {
    const rows = rowsOf(fixture("blueprint-en.md"));
    expect(rows.map((r) => [r.row, r.bloom, r.format, r.count, r.pointsPerItem])).toEqual([
      ["R1", "apply", "multiple-choice", 3, 1.5],
      ["R2", "understand", "open", 2, 2],
      // "Essay" is not a known question type: left empty, no guess.
      ["R3", "create", undefined, 1, 5],
    ]);
  });

  it("leaves an unknown cognitive level empty instead of guessing", () => {
    const md = fixture("blueprint-nl.md").replace("| Evalueren |", "| Beoordelen |");
    expect(rowsOf(md)[3].bloom).toBeUndefined();
  });

  it("reports a Total line that does not match the rows, and does not refuse", () => {
    const md = fixture("blueprint-nl.md").replace("**12**", "**13**");
    const r = parseBlueprintTable(md);
    expect(r).toMatchObject({ totalMismatch: true });
    expect("rows" in r && r.rows).toHaveLength(4);
    const points = fixture("blueprint-nl.md").replace("**20**", "**21**");
    expect(parseBlueprintTable(points)).toMatchObject({ totalMismatch: true });
  });

  it("refuses a result without a blueprint table", () => {
    expect(parseBlueprintTable("## Toetsvragen\n\nVraag 1. Wat is …")).toEqual({
      error: "no-table",
    });
    expect(
      parseBlueprintTable(
        "| Rij | Leeruitkomst | Aantal vragen |\n| --- | --- | --- |\n| Totaal | | 0 |",
      ),
    ).toEqual({ error: "no-rows" });
  });
});

describe("expandToItems", () => {
  it("turns each row into its questions, numbered in order", () => {
    const rows = rowsOf(fixture("blueprint-nl.md"));
    const items = expandToItems(rows, { R1: "lo-1", R2: "lo-1", R3: "lo-2", R4: "lo-2" });
    expect(items).toHaveLength(12);
    expect(items.map((i) => i.label)).toEqual(Array.from({ length: 12 }, (_, i) => String(i + 1)));
    expect(items[0]).toEqual({
      label: "1",
      outcomeId: "lo-1",
      bloom: "apply",
      format: "multiple-choice",
      points: 1,
    });
    expect(items[4]).toMatchObject({ label: "5", outcomeId: "lo-1", format: "open", points: 3 });
    expect(items.reduce((s, i) => s + (i.points ?? 0), 0)).toBe(20);
    const d = setAssessmentItems(alignedCourse(), TEST1, items);
    expect(CourseDataSchema.safeParse(d).success).toBe(true);
  });

  it("skips a row without an outcome and leaves out unknown fields", () => {
    const rows = rowsOf(fixture("blueprint-en.md"));
    const items = expandToItems(rows, { R1: "lo-1", R2: "", R3: "lo-2" });
    expect(items.map((i) => i.label)).toEqual(["1", "2", "3", "4"]);
    expect(items[3]).toEqual({ label: "4", outcomeId: "lo-2", bloom: "create", points: 5 });
  });
});

describe("proposeOutcomeMapping", () => {
  const outcomes = [
    { id: "lo-1", text: "De student berekent een betrouwbaarheidsinterval voor een gemiddelde." },
    { id: "lo-2", text: "De student interpreteert een betrouwbaarheidsinterval in een casus." },
  ];

  it("matches exact text first, ignoring layout and case", () => {
    const rows = rowsOf(fixture("blueprint-nl.md"));
    rows[2].outcomeName = "de student INTERPRETEERT een betrouwbaarheidsinterval  in een casus.";
    expect(proposeOutcomeMapping(rows, outcomes)).toMatchObject({ R1: "lo-1", R3: "lo-2" });
  });

  it("then a normalized start of the text, at least a few words long", () => {
    const rows = rowsOf(fixture("blueprint-nl.md"));
    rows[0].outcomeName = "De student berekent een betrouwbaarheidsinterval";
    expect(proposeOutcomeMapping(rows, outcomes).R1).toBe("lo-1");
    rows[0].outcomeName = "De student";
    expect(proposeOutcomeMapping(rows, outcomes).R1).toBe("");
  });

  it("never proposes anything when in doubt", () => {
    const rows = rowsOf(fixture("blueprint-nl.md"));
    // "Interpreteren van een interval" is a short name: no proposal.
    expect(proposeOutcomeMapping(rows, outcomes)).toMatchObject({ R3: "", R4: "" });
    // A start that fits two outcomes is ambiguous.
    rows[0].outcomeName = "De student";
    const twins = [
      { id: "a", text: "De student berekent het gemiddelde van een steekproef." },
      { id: "b", text: "De student berekent het gemiddelde van een populatie." },
    ];
    rows[0].outcomeName = "De student berekent het gemiddelde";
    expect(proposeOutcomeMapping(rows, twins).R1).toBe("");
  });
});
