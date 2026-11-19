import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { writeXlsx } from "~/lib/export/xlsx";
import { gradeSheets } from "~/lib/utilities/grade/sheet";
import { analyse } from "~/lib/utilities/item-analysis";
import { analysisSheets } from "~/lib/utilities/item-analysis/sheet";
import { rubricSheet } from "~/lib/utilities/rubric";
import { nl } from "~/lib/i18n/messages/nl";
import { sampleRubric } from "./fixtures";

const u = nl.utilities;

async function open(bytes: Uint8Array) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as unknown as ArrayBuffer);
  return wb;
}

describe("gradeSheets (P30.3): points → grade, with the pass mark", () => {
  const scale = {
    maxPoints: 30,
    passPercent: 55,
    passGrade: 5.5,
    minGrade: 1,
    maxGrade: 10,
    decimals: 1 as const,
  };

  it("tabulates every point as a number, with the grade as a number", () => {
    const [table] = gradeSheets(scale, u.grade);
    expect(table!.name).toBe("Cijfertabel");
    expect(table!.header).toEqual(["Punten", "Cijfer"]);
    expect(table!.rows).toHaveLength(31);
    expect(table!.rows[0]).toEqual([0, 1]);
    expect(table!.rows[30]).toEqual([30, 10]);
    expect(table!.formats).toEqual(["0", "0.0"]);
  });

  it("puts the pass mark and the settings on their own sheet", () => {
    const [, settings] = gradeSheets(scale, u.grade);
    expect(settings!.name).toBe("Cesuur");
    expect(settings!.rows).toContainEqual(["Cesuur in punten", 16.5]);
    expect(settings!.rows).toContainEqual(["Cesuur (percentage van de punten)", 55]);
    expect(settings!.rows).toContainEqual(["Cijfer bij de cesuur", 5.5]);
    expect(settings!.rows).not.toContainEqual(expect.arrayContaining(["Raadscore in punten"]));
  });

  it("adds the guessing correction when it is on", () => {
    const [, settings] = gradeSheets({ ...scale, guessing: { options: 4 } }, u.grade);
    expect(settings!.rows).toContainEqual(["Antwoordmogelijkheden per vraag", 4]);
    expect(settings!.rows).toContainEqual(["Raadscore in punten", 7.5]);
  });

  it("formats grades with no decimals as whole numbers", () => {
    expect(gradeSheets({ ...scale, decimals: 0 }, u.grade)[0]!.formats).toEqual(["0", "0"]);
  });
});

describe("analysisSheets (P30.3): per question and the summary, never a score row", () => {
  const stats = analyse({
    items: ["V1", "V2", "V3"],
    maxPoints: [1, 1, 2],
    scores: [
      [1, 0, 2],
      [1, 1, 1],
      [0, 0, 0],
      [1, 1, 2],
    ],
  });

  it("gives a row per question with p, Rit and Rir as numbers", () => {
    const [perItem] = analysisSheets(stats, u.itemAnalysis);
    expect(perItem!.name).toBe("Per vraag");
    expect(perItem!.header).toEqual(["Vraag", "Max", "p", "Rit", "Rir", "Alfa zonder deze vraag"]);
    expect(perItem!.rows).toHaveLength(3);
    expect(perItem!.rows[0]![0]).toBe("V1");
    expect(perItem!.rows[0]![2]).toBeCloseTo(0.75);
    for (const row of perItem!.rows)
      for (const v of row.slice(1)) expect(typeof v).not.toBe("string");
  });

  it("gives the test as a whole on a summary sheet", () => {
    const [, summary] = analysisSheets(stats, u.itemAnalysis);
    expect(summary!.name).toBe("Samenvatting");
    expect(summary!.rows).toContainEqual(["Kandidaten", 4]);
    expect(summary!.rows).toContainEqual(["Vragen", 3]);
    expect(summary!.rows.find((r) => r[0] === "Cronbachs alfa")?.[1]).toBeCloseTo(stats.alpha!);
  });

  it("leaves a value that cannot be computed empty", () => {
    const flat = analyse({
      items: ["V1", "V2"],
      maxPoints: [1, 1],
      scores: [
        [1, 1],
        [1, 1],
        [1, 1],
      ],
    });
    const [perItem, summary] = analysisSheets(flat, u.itemAnalysis);
    expect(perItem!.rows[0]![3]).toBeNull();
    expect(summary!.rows.find((r) => r[0] === "Cronbachs alfa")?.[1]).toBeNull();
  });
});

describe("rubricSheet (P30.3): criteria × levels, points as numbers", () => {
  it("gives a column per level and one for its points", () => {
    const sheet = rubricSheet(sampleRubric(), "Betoog", u.rubric.export);
    expect(sheet.name).toBe("Betoog");
    expect(sheet.header).toEqual([
      "Criterium",
      "Gewicht",
      "Niveau 1",
      "Niveau 1 (pt)",
      "Niveau 2",
      "Niveau 2 (pt)",
      "Niveau 3",
      "Niveau 3 (pt)",
    ]);
    expect(sheet.rows[0]).toEqual([
      "Analyse",
      1,
      "Onvoldoende: Geen analyse.",
      0,
      "Voldoende: Een analyse.",
      2,
      "Goed: Een scherpe analyse.",
      4,
    ]);
  });

  it("marks a knock-out criterion and leaves missing levels empty", () => {
    const row = rubricSheet(sampleRubric(), "Betoog", u.rubric.export).rows[1]!;
    expect(row.slice(0, 2)).toEqual(["Bronnen (knock-out)", 1]);
    expect(row.slice(6)).toEqual([null, null]);
  });

  it("writes a workbook with the points as numbers", async () => {
    const wb = await open(
      await writeXlsx([rubricSheet(sampleRubric(), "Betoog", u.rubric.export)], "Betoog"),
    );
    const ws = wb.worksheets[0]!;
    expect(ws.getCell("D2").value).toBe(0);
    expect(ws.getCell("H2").value).toBe(4);
    expect(ws.getCell("A1").font?.bold).toBe(true);
  });
});

describe("number formats (P30.3)", () => {
  it("applies a column's number format, keeping the value exact", async () => {
    const wb = await open(
      await writeXlsx([{ name: "S", header: ["p"], rows: [[0.456789]], formats: ["0.00"] }], "T"),
    );
    const cell = wb.worksheets[0]!.getCell("A2");
    expect(cell.value).toBe(0.456789);
    expect(cell.numFmt).toBe("0.00");
  });
});
