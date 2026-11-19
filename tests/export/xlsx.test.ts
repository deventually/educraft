import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { exportFormats, toExportDoc } from "~/lib/export/doc";
import { cellValue, exportDocToXlsx, sheetsFromDoc, writeXlsx, XLSX_TYPE } from "~/lib/export/xlsx";

async function open(bytes: Uint8Array) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as unknown as ArrayBuffer);
  return wb;
}

const doc = (markdown: string, locale: "nl" | "en" = "nl", kind: "table" | "document" = "table") =>
  toExportDoc({ title: "Toetsanalyse", locale, sections: [{ heading: null, kind, markdown }] });

const analysis = [
  "## Per vraag",
  "",
  "| Vraag | p-waarde | Rit |",
  "|---|---|---|",
  "| V1 | 0,45 | 0,31 |",
  "| V2 | 3,5 | -0,12 |",
  "",
  "## Samenvatting",
  "",
  "| Maat | Waarde |",
  "|---|---|",
  "| Alfa | 0,78 |",
].join("\n");

describe("cellValue (P30.3)", () => {
  it("makes a Dutch decimal comma a number", () => {
    expect(cellValue("3,5", "nl")).toBe(3.5);
    expect(cellValue("-0,12", "nl")).toBe(-0.12);
    expect(cellValue("12", "nl")).toBe(12);
  });

  it("reads a decimal point too, as models often write 0.45 in Dutch", () => {
    expect(cellValue("0.45", "nl")).toBe(0.45);
    expect(cellValue("3.5", "en")).toBe(3.5);
  });

  it("keeps what could be a thousands separator as text, instead of guessing", () => {
    expect(cellValue("1.250", "nl")).toBe("1.250");
    expect(cellValue("1,250", "en")).toBe("1,250");
  });

  it("keeps words, ranges and mixed text as text", () => {
    expect(cellValue("V1", "nl")).toBe("V1");
    expect(cellValue("3-5", "nl")).toBe("3-5");
    expect(cellValue("45%", "nl")).toBe("45%");
    expect(cellValue("", "nl")).toBe("");
  });
});

describe("sheetsFromDoc (P30.3)", () => {
  it("makes one sheet per table, named after the heading above it", () => {
    const sheets = sheetsFromDoc(doc(analysis));
    expect(sheets.map((s) => s.name)).toEqual(["Per vraag", "Samenvatting"]);
    expect(sheets[0]!.header).toEqual(["Vraag", "p-waarde", "Rit"]);
    expect(sheets[0]!.rows).toEqual([
      ["V1", 0.45, 0.31],
      ["V2", 3.5, -0.12],
    ]);
  });

  it("falls back to the step's name, then to 'Tabel n'", () => {
    const d = toExportDoc({
      title: "T",
      locale: "nl",
      sections: [
        { heading: "Toetsmatrijs", kind: "table", markdown: "| A |\n|---|\n| 1 |" },
        { heading: null, kind: "table", markdown: "| B |\n|---|\n| 2 |" },
      ],
    });
    expect(sheetsFromDoc(d).map((s) => s.name)).toEqual(["Toetsmatrijs", "Tabel 2"]);
  });

  it("says 'Table n' in English", () => {
    expect(sheetsFromDoc(doc("| A |\n|---|\n| 1 |", "en"))[0]!.name).toBe("Table 1");
  });

  it("finds no sheet in a result without a table", () => {
    expect(sheetsFromDoc(doc("## Uitleg\n\nGeen tabel."))).toEqual([]);
  });
});

describe("exportFormats (P30.3)", () => {
  it("offers Excel for a table result that has a table", () => {
    expect(exportFormats(doc(analysis))).toEqual(["docx", "pdf", "xlsx", "md"]);
  });

  it("offers no Excel when the result has no table, whatever its kind", () => {
    expect(exportFormats(doc("## Uitleg\n\nGeen tabel."))).toEqual(["docx", "pdf", "md"]);
  });

  it("offers no Excel for a document, even with a table in it", () => {
    expect(exportFormats(doc(analysis, "nl", "document"))).toEqual(["docx", "pdf", "md"]);
  });
});

describe("exportDocToXlsx (P30.3)", () => {
  it("writes a workbook that opens, a sheet per table", async () => {
    const wb = await open(await exportDocToXlsx(doc(analysis)));
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Per vraag", "Samenvatting"]);
    expect(XLSX_TYPE).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  });

  it("makes the header row bold and frozen", async () => {
    const ws = (await open(await exportDocToXlsx(doc(analysis)))).worksheets[0]!;
    expect(ws.getRow(1).values).toEqual([undefined, "Vraag", "p-waarde", "Rit"]);
    expect(ws.getCell("A1").font?.bold).toBe(true);
    expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
  });

  it("keeps numbers numbers, also 3,5", async () => {
    const ws = (await open(await exportDocToXlsx(doc(analysis)))).worksheets[0]!;
    expect(ws.getCell("B3").value).toBe(3.5);
    expect(ws.getCell("B3").type).toBe(ExcelJS.ValueType.Number);
    expect(ws.getCell("A2").value).toBe("V1");
  });

  it("never writes a formula: text that starts with = stays text", async () => {
    const md = '| Cel |\n|---|\n| =HYPERLINK("http://x","klik") |\n| @SUM(A1) |\n| +1+1 |';
    const ws = (await open(await exportDocToXlsx(doc(md)))).worksheets[0]!;
    for (const ref of ["A2", "A3", "A4"]) {
      expect(ws.getCell(ref).type).toBe(ExcelJS.ValueType.String);
      expect(ws.getCell(ref).formula).toBeUndefined();
    }
    expect(ws.getCell("A2").value).toBe('=HYPERLINK("http://x","klik")');
  });

  it("sizes columns to their content, within bounds", async () => {
    const md = `| Kort | ${"lang ".repeat(40)} |\n|---|---|\n| a | b |`;
    const ws = (await open(await exportDocToXlsx(doc(md)))).worksheets[0]!;
    expect(ws.getColumn(1).width).toBeGreaterThanOrEqual(8);
    expect(ws.getColumn(2).width).toBeLessThanOrEqual(60);
    expect(ws.getColumn(2).width!).toBeGreaterThan(ws.getColumn(1).width!);
  });

  it("pads short rows so every row has the header's width", async () => {
    const ws = (await open(await exportDocToXlsx(doc("| A | B |\n|---|---|\n| 1 |"))))
      .worksheets[0]!;
    expect(ws.getCell("A2").value).toBe(1);
    expect(ws.getCell("B2").value).toBeNull();
  });

  it("keeps sheet names within Excel's rules: 31 characters, no []:*?/\\, unique", async () => {
    const long = "Een heel lange kop: met [haken] en / tekens * die Excel weigert?";
    const md = [`## ${long}`, "| A |\n|---|\n| 1 |", `## ${long}`, "| B |\n|---|\n| 2 |"].join(
      "\n\n",
    );
    const wb = await open(await exportDocToXlsx(doc(md)));
    const names = wb.worksheets.map((w) => w.name);
    for (const n of names) {
      expect(n.length).toBeLessThanOrEqual(31);
      expect(n).not.toMatch(/[[\]:*?/\\]/);
    }
    expect(new Set(names).size).toBe(2);
  });

  it("names the workbook after the result", async () => {
    const wb = await open(
      await writeXlsx([{ name: "Blad", header: ["A"], rows: [[1]] }], "Mijn titel"),
    );
    expect(wb.title).toBe("Mijn titel");
    expect(wb.creator).toBe("LimeOnIt");
  });
});
