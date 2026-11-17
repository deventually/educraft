/**
 * The Bloom check in the course wizard (experiment, 2026-11-17), the pure half: the outcomes the
 * wizard writes, Jev's check on each (`bloomCheck`, exactly what the app runs) and Bastiaan's
 * labels. The question: when the check speaks up, is the AI's level really off, and does it miss
 * many wrong levels? Without the check the teacher sees the AI's level only, so that is the
 * comparison.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BloomLevel } from "~/lib/courses/bloom";
import { bloomCheck, type LevelP } from "~/lib/courses/bloomJev";
import type { DesignCase } from "./eval-design-helpers";

/** One outcome the wizard wrote, with the level it intended. */
export interface WizardOutcome {
  course: string;
  locale: "nl" | "en";
  text: string;
  intended: BloomLevel | null;
}

/** The courses to generate from: the wizard eval's cases and the new briefs, nothing empty. */
export function loadCheckCourses(): DesignCase[] {
  const read = (file: string) =>
    (JSON.parse(readFileSync(join(__dirname, "../evals", file), "utf8")) as { cases: DesignCase[] })
      .cases;
  return [...read("course-design-outcomes/cases.json"), ...read("bloom-check/briefs.json")].filter(
    (c) => !c.expectEmpty,
  );
}

/** Each outcome once (the first run's level), in order. */
export function uniqueOutcomes(all: readonly WizardOutcome[]): WizardOutcome[] {
  const seen = new Set<string>();
  return all.filter((o) => {
    const k = o.text.trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** One Jev run on one outcome; `p` null when Jev did not answer. */
export interface CheckRow extends WizardOutcome {
  run: number;
  p: LevelP | null;
}

export type Labels = Record<string, BloomLevel | null>;

interface CheckScore {
  /** Rows (outcome × run) with a label and an answer from Jev. */
  labelled: number;
  /** The AI's intended level is Bastiaan's label. */
  aiRight: number;
  /** The check spoke up … */
  flagged: number;
  /** … and the AI's level was indeed off. */
  flaggedRight: number;
  /** … and the level Jev heard is Bastiaan's label. */
  suggestionRight: number;
  /** The AI's level was off and the check said nothing. */
  missed: number;
  unanswered: number;
}

export function scoreCheck(rows: readonly CheckRow[], labels: Labels): CheckScore {
  const s: CheckScore = {
    labelled: 0,
    aiRight: 0,
    flagged: 0,
    flaggedRight: 0,
    suggestionRight: 0,
    missed: 0,
    unanswered: 0,
  };
  for (const r of rows) {
    if (!(r.text in labels)) continue;
    if (!r.p) {
      s.unanswered++;
      continue;
    }
    const label = labels[r.text] ?? null;
    const aiRight = r.intended === label;
    const check = bloomCheck(r.intended ?? undefined, r.p);
    s.labelled++;
    if (aiRight) s.aiRight++;
    if (check !== undefined) {
      s.flagged++;
      if (!aiRight) s.flaggedRight++;
      if (check === label) s.suggestionRight++;
    } else if (!aiRight) s.missed++;
  }
  return s;
}

/** Outcomes whose check came out the same in every run. */
export function stableChecks(rows: readonly CheckRow[]): { stable: number; outcomes: number } {
  const by = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.p) continue;
    const set = by.get(r.text) ?? new Set();
    set.add(String(bloomCheck(r.intended ?? undefined, r.p)));
    by.set(r.text, set);
  }
  return { stable: [...by.values()].filter((v) => v.size === 1).length, outcomes: by.size };
}

export function checkReport(input: {
  date: string;
  jevModel: string;
  llmModel: string;
  repeat: number;
  rows: CheckRow[];
  labels: Labels;
  jevMs: number[];
  jevCostUsd: number;
}): string {
  const s = scoreCheck(input.rows, input.labels);
  const st = stableChecks(input.rows);
  const outcomes = new Set(input.rows.map((r) => r.text)).size;
  const unlabelled = [...new Set(input.rows.map((r) => r.text))].filter(
    (t) => !(t in input.labels),
  ).length;
  const wrong = s.labelled - s.aiRight;
  const ms = input.jevMs.length
    ? Math.round(input.jevMs.reduce((a, b) => a + b, 0) / input.jevMs.length)
    : 0;
  return [
    "# Eval — Bloom-check in de cursuswizard (Jev)",
    "",
    `Datum: ${input.date} · Jev: ${input.jevModel} · leeruitkomsten van de wizard: ${input.llmModel} (course-design-outcomes@v1) · herhalingen Jev: ${input.repeat}`,
    "",
    "Drempel 0,7, vast (dezelfde als bij de import). Goed = hetzelfde als Bastiaans label, ook \"geen niveau\". Rijen = leeruitkomst × herhaling.",
    "",
    `Leeruitkomsten: ${outcomes} (ongelabeld: ${unlabelled}). Rijen met label en antwoord: ${s.labelled}; geen antwoord van Jev: ${s.unanswered}.`,
    "",
    "| | Aantal |",
    "| --- | --- |",
    `| Niveau van de AI klopt | ${s.aiRight}/${s.labelled} |`,
    `| Niveau van de AI klopt niet | ${wrong}/${s.labelled} |`,
    `| De check meldt zich | ${s.flagged} |`,
    `| … terecht (niveau van de AI klopte niet) | ${s.flaggedRight}/${s.flagged} |`,
    `| … en Jevs niveau is Bastiaans label | ${s.suggestionRight}/${s.flagged} |`,
    `| Fout niveau zonder melding (gemist) | ${s.missed}/${wrong} |`,
    "",
    `Stabiel over de herhalingen: ${st.stable}/${st.outcomes} leeruitkomsten. Jev: ${ms} ms per leeruitkomst, $${input.jevCostUsd.toFixed(6)} voor de hele meting.`,
    "",
  ].join("\n");
}
