/**
 * The Excel writer (brief P30.3, `exceljs`). Every table in a result becomes its own sheet: the
 * header row bold and frozen, columns sized to their content, numbers kept as numbers (also a
 * Dutch `3,5`). The tools without AI (rubric, grade calculator, item analysis) hand their own
 * `Sheet`s to `writeXlsx`, in the browser, so a score list never reaches the server.
 *
 * A text cell is always written as a string, never as a formula, so `=HYPERLINK(…)` in a result
 * is shown as text and never runs (formula injection).
 */
import ExcelJS from "exceljs";
import type { Locale } from "~/lib/i18n";
import type { ExportDoc } from "./doc";
import type { Run } from "./markdown";

export { XLSX_TYPE } from "./formats";

type Cell = string | number | null;

export interface Sheet {
  /** Shown on the tab; made valid and unique by the writer. */
  name: string;
  header: string[];
  rows: Cell[][];
  /** An Excel number format per column (`"0.00"`); the value itself stays exact. */
  formats?: (string | undefined)[];
}

const DECIMAL_COMMA = /^-?\d+(,\d+)?$/;
const DECIMAL_POINT = /^-?\d+(\.\d+)?$/;
/** `1.250` in Dutch, `1,250` in English: a thousands separator or a decimal? We don't guess. */
const AMBIGUOUS = { nl: /^-?\d{1,3}\.\d{3}$/, en: /^-?\d{1,3},\d{3}$/ } as const;

/**
 * A number when the text is plainly one in this language, else the text as written. Dutch takes
 * a decimal comma and a decimal point (models often write 0.45); English only a point.
 */
export function cellValue(text: string, locale: Locale): string | number {
  const s = text.trim();
  if (AMBIGUOUS[locale].test(s)) return text;
  if (DECIMAL_POINT.test(s)) return Number(s);
  if (locale === "nl" && DECIMAL_COMMA.test(s)) return Number(s.replace(",", "."));
  return text;
}

const plain = (runs: Run[]) =>
  runs
    .map((r) => (r.break ? `\n${r.text}` : r.text))
    .join("")
    .trim();

const TABLE_WORD: Record<Locale, string> = { nl: "Tabel", en: "Table" };

/** Every table in the result, named after the nearest heading above it (or the step's name). */
export function sheetsFromDoc(doc: ExportDoc): Sheet[] {
  const sheets: Sheet[] = [];
  for (const section of doc.sections) {
    let name: string | null = section.heading;
    for (const block of section.blocks) {
      if (block.type === "heading") name = plain(block.runs);
      if (block.type !== "table") continue;
      sheets.push({
        name: name || `${TABLE_WORD[doc.locale]} ${sheets.length + 1}`,
        header: block.header.map(plain),
        rows: block.rows.map((row) => row.map((c) => cellValue(plain(c), doc.locale))),
      });
      name = null;
    }
  }
  return sheets;
}

const MAX_NAME = 31;

/** Excel refuses `[]:*?/\` and names over 31 characters, and each name once per workbook. */
function sheetNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((raw, i) => {
    const base =
      raw
        .replace(/[[\]:*?/\\]/g, " ")
        .replace(/\s+/g, " ")
        .trim() || `${i + 1}`;
    let name = base.slice(0, MAX_NAME).trim();
    for (let n = 2; used.has(name.toLowerCase()); n++) {
      const suffix = ` (${n})`;
      name = `${base.slice(0, MAX_NAME - suffix.length).trim()}${suffix}`;
    }
    used.add(name.toLowerCase());
    return name;
  });
}

const MIN_WIDTH = 8;
const MAX_WIDTH = 60;

function width(values: Cell[]): number {
  const longest = Math.max(
    0,
    ...values.map((v) =>
      Math.max(
        0,
        ...String(v ?? "")
          .split("\n")
          .map((l) => l.length),
      ),
    ),
  );
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, longest + 2));
}

/** The workbook as bytes. `title` goes in the file's properties. */
export async function writeXlsx(sheets: Sheet[], title: string): Promise<Uint8Array<ArrayBuffer>> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "LimeOnIt";
  wb.title = title;
  const names = sheetNames(sheets.map((s) => s.name));
  sheets.forEach((sheet, i) => {
    const ws = wb.addWorksheet(names[i], { views: [{ state: "frozen", ySplit: 1 }] });
    const cols = sheet.header.length;
    const rows = sheet.rows.map((r) => Array.from({ length: cols }, (_, j) => r[j] ?? null));
    ws.addRow(sheet.header).font = { bold: true };
    // `richText`/`formula` never: a string cell is plain text, whatever it starts with.
    for (const row of rows) ws.addRow(row);
    for (let j = 0; j < cols; j++) {
      const column = ws.getColumn(j + 1);
      column.width = width([sheet.header[j] ?? "", ...rows.map((r) => r[j] ?? null)]);
      const format = sheet.formats?.[j];
      if (!format) continue;
      column.eachCell((cell, row) => {
        if (row > 1) cell.numFmt = format;
      });
    }
  });
  // A copy: `writeBuffer` gives a Node Buffer on the server and an ArrayBuffer in the browser.
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

/** A result as a workbook, a sheet per table (brief P30.3). */
export function exportDocToXlsx(doc: ExportDoc): Promise<Uint8Array<ArrayBuffer>> {
  return writeXlsx(sheetsFromDoc(doc), doc.title);
}
