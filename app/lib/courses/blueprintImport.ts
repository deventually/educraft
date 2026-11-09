/**
 * Reads the blueprint table of a test-blueprint result into course questions
 * (brief P26, 26.2). Pure, no LLM. The table has a fixed shape (rows R1, R2, …;
 * outcome · cognitive level · question type · number · points per question ·
 * points; a Total line), in Dutch or English. Columns are found by their header,
 * so a reordered table still reads. An unknown level or type stays empty: no guess.
 */
import { normalizeForMatch } from "~/lib/documents/locate";
import type { BloomLevel } from "./bloom";
import type { AssessmentItem, ItemFormat, LearningOutcome } from "./types";

export interface BlueprintRow {
  row: string;
  outcomeName: string;
  bloom?: BloomLevel;
  format?: ItemFormat;
  count: number;
  pointsPerItem?: number;
}

export type BlueprintParse =
  | { rows: BlueprintRow[]; totalMismatch: boolean }
  | { error: "no-table" | "no-rows" };

const BLOOM: Record<string, BloomLevel> = {
  onthouden: "remember",
  remember: "remember",
  begrijpen: "understand",
  understand: "understand",
  toepassen: "apply",
  apply: "apply",
  analyseren: "analyze",
  analyse: "analyze",
  analyze: "analyze",
  evalueren: "evaluate",
  evaluate: "evaluate",
  creeren: "create",
  create: "create",
};

const FORMAT: Record<string, ItemFormat> = {
  meerkeuze: "multiple-choice",
  meerkeuzevraag: "multiple-choice",
  "multiple choice": "multiple-choice",
  "multiple-choice": "multiple-choice",
  open: "open",
  "open vraag": "open",
  "open question": "open",
};

type Column = "row" | "outcome" | "bloom" | "format" | "count" | "perItem" | "points";

const HEADERS: [Column, RegExp][] = [
  ["row", /^(rij|row)$/],
  ["outcome", /^(leeruitkomst|learning outcome)$/],
  ["bloom", /^(denkniveau|cognitive level)$/],
  ["format", /^(vraagvorm|question type)$/],
  ["count", /^(aantal vragen|number of questions)$/],
  ["perItem", /^(punten per vraag|points per question)$/],
  ["points", /^(punten|points)$/],
];

/** Lower case, without Markdown emphasis or diacritics, single spaces. */
function plain(cell: string): string {
  return cell
    .replace(/[*_`]/g, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cells(line: string): string[] | null {
  const t = line.trim();
  if (!t.startsWith("|")) return null;
  return t
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function number(cell: string | undefined): number | undefined {
  const t = plain(cell ?? "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(t)) return undefined;
  return Number(t);
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.01;

export function parseBlueprintTable(markdown: string): BlueprintParse {
  const lines = markdown.split(/\r?\n/);
  for (let h = 0; h < lines.length; h++) {
    const header = cells(lines[h] ?? "");
    if (!header) continue;
    const col = new Map<Column, number>();
    header.forEach((name, i) => {
      const found = HEADERS.find(([, re]) => re.test(plain(name)));
      if (found && !col.has(found[0])) col.set(found[0], i);
    });
    if (!col.has("row") || !col.has("outcome") || !col.has("count")) continue;

    const rows: BlueprintRow[] = [];
    let total: { count?: number; points?: number } | undefined;
    for (let i = h + 1; i < lines.length; i++) {
      const c = cells(lines[i] ?? "");
      if (!c) break;
      const at = (k: Column) => (col.has(k) ? c[col.get(k) as number] : undefined);
      const label = plain(at("row") ?? "");
      if (/^(totaal|total)$/.test(label)) {
        total = { count: number(at("count")), points: number(at("points")) };
        continue;
      }
      if (!/^r\d+$/.test(label)) continue;
      const count = number(at("count"));
      if (count === undefined || !Number.isInteger(count) || count < 1) continue;
      const row: BlueprintRow = {
        row: label.toUpperCase(),
        outcomeName: (at("outcome") ?? "").replace(/[*_`]/g, "").trim(),
        count,
      };
      const bloom = BLOOM[plain(at("bloom") ?? "")];
      if (bloom) row.bloom = bloom;
      const format = FORMAT[plain(at("format") ?? "")];
      if (format) row.format = format;
      const perItem = number(at("perItem"));
      if (perItem !== undefined) row.pointsPerItem = perItem;
      rows.push(row);
    }
    if (rows.length === 0) return { error: "no-rows" };

    const count = rows.reduce((s, r) => s + r.count, 0);
    const points = rows.reduce((s, r) => s + r.count * (r.pointsPerItem ?? 0), 0);
    const totalMismatch =
      (total?.count !== undefined && !near(total.count, count)) ||
      (total?.points !== undefined && !near(total.points, points));
    return { rows, totalMismatch };
  }
  return { error: "no-table" };
}

/** Row → outcome id; an empty or missing id leaves the row out. */
export type OutcomeMapping = Record<string, string>;

/** What the course page offers for one linked result: the rows and a proposal, or why not. */
export type BlueprintOffer =
  | { rows: BlueprintRow[]; totalMismatch: boolean; proposal: OutcomeMapping }
  | { error: "no-table" | "no-rows" };

/** Each row becomes its questions, numbered 1…n across the rows that are kept. */
export function expandToItems(
  rows: BlueprintRow[],
  mapping: OutcomeMapping,
): Omit<AssessmentItem, "id">[] {
  const items: Omit<AssessmentItem, "id">[] = [];
  for (const r of rows) {
    const outcomeId = mapping[r.row];
    if (!outcomeId) continue;
    for (let n = 0; n < r.count; n++) {
      const item: Omit<AssessmentItem, "id"> = { label: String(items.length + 1), outcomeId };
      if (r.bloom) item.bloom = r.bloom;
      if (r.format) item.format = r.format;
      if (r.pointsPerItem !== undefined) item.points = r.pointsPerItem;
      items.push(item);
    }
  }
  return items;
}

/** A prefix match needs this many words, so "De student" never decides. */
const MIN_PREFIX_WORDS = 4;

/**
 * A proposal per row: the outcome with exactly the same text, else the one
 * outcome whose text starts with the row's name (or the other way round).
 * Anything ambiguous or short stays empty; the teacher chooses.
 */
export function proposeOutcomeMapping(
  rows: BlueprintRow[],
  outcomes: Pick<LearningOutcome, "id" | "text">[],
): OutcomeMapping {
  const texts = outcomes.map((o) => ({ id: o.id, text: normalizeForMatch(o.text) }));
  const strip = (s: string) => s.replace(/[.;:]$/, "");
  const proposal: OutcomeMapping = {};
  for (const r of rows) {
    const name = strip(normalizeForMatch(r.outcomeName));
    const exact = texts.filter((o) => strip(o.text) === name);
    if (exact.length === 1) {
      proposal[r.row] = exact[0]?.id ?? "";
      continue;
    }
    const prefix =
      name.split(" ").length >= MIN_PREFIX_WORDS
        ? texts.filter((o) => o.text.startsWith(name) || name.startsWith(strip(o.text)))
        : [];
    proposal[r.row] = prefix.length === 1 ? (prefix[0]?.id ?? "") : "";
  }
  return proposal;
}
