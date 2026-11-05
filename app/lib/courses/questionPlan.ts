/**
 * The fixed plan per question, computed from a test blueprint table (metingen t and u).
 * Pure, no LLM. The questions stage gets one line per question, numbered 1…n in
 * blueprint order, with its row, cognitive level, question type and points, so the
 * model no longer works out which row a question belongs to. Unknown cells are not
 * guessed: the line then points back to the blueprint.
 */
import type { OutputLanguage } from "~/lib/registry/types";
import { bloomLabel } from "./bloom";
import { type BlueprintRow, parseBlueprintTable } from "./blueprintImport";

const TEXT = {
  nl: {
    question: "Vraag",
    row: "Rij",
    mc: "meerkeuze met vier opties (A tot en met D)",
    open: "open vraag",
    noLevel: "denkniveau volgens de matrijs",
    noType: "vraagvorm volgens de matrijs",
    noPoints: "punten volgens de matrijs",
    total: (n: number, p?: string) => `Totaal: ${n} vragen${p ? `, ${p} punten` : ""}.`,
    none: "Geen vaste indeling: de tabel in de matrijs is niet te lezen. Staat er wel een tabel, volg die dan zelf; staat er geen, schrijf dan geen vragen.",
  },
  en: {
    question: "Question",
    row: "Row",
    mc: "multiple choice with four options (A to D)",
    open: "open question",
    noLevel: "cognitive level as in the blueprint",
    noType: "question type as in the blueprint",
    noPoints: "points as in the blueprint",
    total: (n: number, p?: string) => `Total: ${n} questions${p ? `, ${p} points` : ""}.`,
    none: "No fixed plan: the blueprint table cannot be read. If there is a table, follow it yourself; if there is none, write no questions.",
  },
} as const;

function amount(n: number, lang: OutputLanguage): string {
  const s = String(Math.round(n * 100) / 100);
  return lang === "nl" ? s.replace(".", ",") : s;
}

export function questionPlan(blueprintMarkdown: string, lang: OutputLanguage): string {
  const t = TEXT[lang];
  const parsed = parseBlueprintTable(blueprintMarkdown);
  if ("error" in parsed) return t.none;

  const line = (n: number, r: BlueprintRow) => {
    const points =
      r.pointsPerItem === undefined ? t.noPoints : `${amount(r.pointsPerItem, lang)} pt`;
    const level = r.bloom ? bloomLabel(r.bloom, lang) : t.noLevel;
    const type = r.format === "multiple-choice" ? t.mc : r.format === "open" ? t.open : t.noType;
    return `- ${t.question} ${n} (${points}): ${t.row} ${r.row}, ${level}, ${type}`;
  };

  const lines: string[] = [];
  for (const r of parsed.rows) {
    for (let i = 0; i < r.count; i++) lines.push(line(lines.length + 1, r));
  }
  const allPoints = parsed.rows.every((r) => r.pointsPerItem !== undefined);
  const points = parsed.rows.reduce((s, r) => s + r.count * (r.pointsPerItem ?? 0), 0);
  lines.push("", t.total(lines.length, allPoints ? amount(points, lang) : undefined));
  return lines.join("\n");
}
