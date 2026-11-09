/**
 * Item analysis after a test (P24.5a). Pure functions, no AI, no network: classical test theory
 * on an anonymous score list (rows = candidates, columns = questions).
 *
 * - p-value: the mean score on a question as a share of its maximum.
 * - Rit: correlation of the question with the total score; Rir: with the total of the other
 *   questions (the Rit without the question's own share in the total).
 * - Cronbach's alpha (Cronbach, 1951, Psychometrika 16(3)), and alpha with the question left out.
 *
 * Variances are sample variances (n − 1); alpha and the correlations do not depend on that
 * choice, as long as it is the same everywhere.
 */

export interface ScoreTable {
  /** Question labels, in column order. */
  items: string[];
  /** Maximum points per question, > 0. */
  maxPoints: number[];
  /** One row per candidate, one score per question. No names: rows are anonymous. */
  scores: number[][];
}

export interface ItemStats {
  item: string;
  max: number;
  mean: number;
  /** Mean score as a share of the maximum, 0–1. */
  p: number;
  /** Item–total correlation; null when the question or the total does not vary. */
  rit: number | null;
  /** Item–rest correlation; null when the question or the rest does not vary. */
  rir: number | null;
  /** Alpha of the test without this question; null with fewer than three questions. */
  alphaIfDeleted: number | null;
}

export interface TestStats {
  candidates: number;
  items: ItemStats[];
  /** Null when the totals do not vary or there are fewer than two questions. */
  alpha: number | null;
  meanTotal: number;
  sdTotal: number;
  maxTotal: number;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const mean = (xs: number[]) => sum(xs) / xs.length;

/** Sum of squared deviations from the mean. */
function sumSquares(xs: number[]): number {
  const m = mean(xs);
  return sum(xs.map((x) => (x - m) ** 2));
}

function variance(xs: number[]): number {
  return xs.length < 2 ? 0 : sumSquares(xs) / (xs.length - 1);
}

/** Pearson correlation; null when either side does not vary. */
function correlation(xs: number[], ys: number[]): number | null {
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = (xs[i] as number) - mx;
    const dy = (ys[i] as number) - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx <= 1e-12 || syy <= 1e-12) return null;
  return Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy)));
}

/** Cronbach's alpha over the given columns. */
function alphaOf(columns: number[][]): number | null {
  const k = columns.length;
  if (k < 2) return null;
  const n = columns[0]?.length ?? 0;
  const totals = Array.from({ length: n }, (_, r) => sum(columns.map((c) => c[r] as number)));
  const totalVar = variance(totals);
  if (totalVar <= 1e-12) return null;
  const itemVar = sum(columns.map(variance));
  return (k / (k - 1)) * (1 - itemVar / totalVar);
}

export function analyse(table: ScoreTable): TestStats {
  const k = table.items.length;
  const columns = table.items.map((_, j) => table.scores.map((row) => row[j] as number));
  const totals = table.scores.map(sum);
  const items: ItemStats[] = table.items.map((item, j) => {
    const col = columns[j] as number[];
    const max = table.maxPoints[j] as number;
    const m = mean(col);
    const rest = totals.map((t, r) => t - (col[r] as number));
    return {
      item,
      max,
      mean: m,
      p: m / max,
      rit: correlation(col, totals),
      rir: correlation(col, rest),
      alphaIfDeleted: k < 3 ? null : alphaOf(columns.filter((_, i) => i !== j)),
    };
  });
  return {
    candidates: table.scores.length,
    items,
    alpha: alphaOf(columns),
    meanTotal: mean(totals),
    sdTotal: Math.sqrt(variance(totals)),
    maxTotal: sum(table.maxPoints),
  };
}

// ---------------------------------------------------------------------------------------------
// Parsing a pasted score list
// ---------------------------------------------------------------------------------------------

const MIN_CANDIDATES = 3;
const MAX_CANDIDATES = 5000;
const MAX_ITEMS = 200;

export type ParseError =
  | "empty"
  | "tooFewCandidates"
  | "tooFewItems"
  | "tooLarge"
  | "negative"
  | "aboveMax"
  | "maxCount"
  | "maxInvalid";

export type ParseResult =
  | {
      ok: true;
      table: ScoreTable;
      /** Columns left out because they are not a question or may identify a candidate. */
      removedColumns: string[];
      /** Empty cells, counted as 0 points. */
      blanks: number;
      /** True when no maximum was given and the highest score per question is used. */
      maxFromData: boolean;
    }
  | { ok: false; error: ParseError };

/**
 * A header that names a person or a total: names, student numbers, e-mail, codes, totals and
 * grades are never a question. Dutch and English.
 */
const NOT_A_QUESTION =
  /naam|name|student|nummer|number|^id$|e-?mail|code|kandida|candidate|totaal|^total|^som$|^sum$|^score$|cijfer|grade|klas|class|groep|group/i;

/** Six digits or more looks like a student number, never a score on one question. */
const STUDENT_NUMBER = /^\d{6,}$/;

function separatorOf(lines: string[]): string {
  if (lines.some((l) => l.includes("\t"))) return "\t";
  if (lines.some((l) => l.includes(";"))) return ";";
  return ",";
}

function toNumber(cell: string, decimalComma: boolean): number | null {
  const s = decimalComma ? cell.replace(",", ".") : cell;
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
}

function parseMax(raw: string, count: number): number[] | ParseError | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const values = trimmed.split(/[;\s]+/).map((t) => toNumber(t, true));
  if (values.some((v) => v === null || v <= 0)) return "maxInvalid";
  if (values.length === 1) return Array.from({ length: count }, () => values[0] as number);
  if (values.length !== count) return "maxCount";
  return values as number[];
}

/**
 * Read a score list as pasted from a spreadsheet (tab, semicolon or comma separated; a decimal
 * comma with tabs or semicolons). Columns with names, student numbers or totals are removed
 * before anything else happens, and reported, so they are never analysed or sent.
 */
export function parseScores(text: string, maxInput = ""): ParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() !== "");
  if (lines.length === 0) return { ok: false, error: "empty" };
  const sep = separatorOf(lines);
  const decimalComma = sep !== ",";
  let rows = lines.map((l) => l.split(sep).map((c) => c.trim()));
  const width = Math.max(...rows.map((r) => r.length));
  rows = rows.map((r) => [...r, ...Array.from({ length: width - r.length }, () => "")]);
  const num = (c: string) => toNumber(c, decimalComma);

  // A header: the first row has text where the next row has a number.
  const [first, second] = rows;
  const hasHeader =
    !!first &&
    !!second &&
    first.some((cell, j) => cell !== "" && num(cell) === null && num(second[j] ?? "") !== null);
  const header = hasHeader ? (first as string[]) : null;
  const data = hasHeader ? rows.slice(1) : rows;
  const label = (j: number) => (header?.[j] ? (header[j] as string) : String(j + 1));

  const keep: number[] = [];
  const removedColumns: string[] = [];
  for (let j = 0; j < width; j++) {
    const cells = data.map((r) => r[j] as string).filter((c) => c !== "");
    const identifying =
      (header?.[j] !== undefined && NOT_A_QUESTION.test(header[j] as string)) ||
      cells.some((c) => num(c) === null) ||
      (cells.length > 0 && cells.every((c) => STUDENT_NUMBER.test(c)));
    if (cells.length === 0 && !header?.[j]) continue;
    if (identifying) removedColumns.push(label(j));
    else keep.push(j);
  }

  if (data.length > MAX_CANDIDATES || keep.length > MAX_ITEMS) {
    return { ok: false, error: "tooLarge" };
  }
  if (keep.length < 2) return { ok: false, error: "tooFewItems" };
  if (data.length < MIN_CANDIDATES) return { ok: false, error: "tooFewCandidates" };

  let blanks = 0;
  const scores = data.map((r) =>
    keep.map((j) => {
      const cell = r[j] as string;
      if (cell === "") {
        blanks++;
        return 0;
      }
      return num(cell) as number;
    }),
  );
  if (scores.some((r) => r.some((v) => v < 0))) return { ok: false, error: "negative" };

  const given = parseMax(maxInput, keep.length);
  if (typeof given === "string") return { ok: false, error: given };
  const maxPoints = given ?? keep.map((_, j) => Math.max(1, ...scores.map((r) => r[j] as number)));
  if (scores.some((r) => r.some((v, j) => v > (maxPoints[j] as number) + 1e-9))) {
    return { ok: false, error: "aboveMax" };
  }

  return {
    ok: true,
    table: { items: keep.map(label), maxPoints, scores },
    removedColumns,
    blanks,
    maxFromData: given === null,
  };
}
