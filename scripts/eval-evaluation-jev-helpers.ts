/**
 * Jev counts the themes of a course evaluation (`app/lib/courses/themeCountJev.ts`): the cases with
 * the truth per answer, matching a theme of the LLM to the truth, and the report. Pure;
 * `scripts/eval-evaluation-jev.ts` makes the calls.
 *
 * Two questions, both against the truth written in `evals/evaluation-jev/cases.json` before any
 * measurement: is the number next to a theme right when the LLM gives it, and when Jev counts it
 * (on the LLM's own themes, as the app would ask)? And per answer: does Jev see the theme where it
 * is, and not where it is not (on the true themes, as if the LLM named them perfectly)?
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type CountTheme, type MentionVerdict, type ThemeCount, evaluationAnswers } from "~/lib/courses/themeCountJev";
import { normalizeForMatch } from "~/lib/documents/locate";
import { THEME_COUNT_JEV_THRESHOLDS } from "~/lib/courses/themeCountJev";
import type { EvaluationCase } from "./eval-evaluation-helpers";
import { EVALS_DIR } from "./eval-files";

export interface ThemeCountCase {
  case: EvaluationCase;
  answers: string[];
  /** The true themes, in the case's language. */
  themes: CountTheme[];
  /** Per answer: the keys of the themes it makes. */
  lines: string[][];
}

interface RawGold {
  from?: string;
  themes: Record<string, { polarity: CountTheme["polarity"]; label: string }>;
  lines: string[][];
}

export function loadThemeCountCases(): ThemeCountCase[] {
  const read = (dir: string) =>
    JSON.parse(readFileSync(join(EVALS_DIR, dir, "cases.json"), "utf8")) as { cases: unknown[] };
  const base = new Map(
    (read("course-evaluation").cases as EvaluationCase[]).map((c) => [c.id, c] as const),
  );
  return (read("evaluation-jev").cases as (RawGold & Partial<EvaluationCase>)[]).map((g) => {
    const c = g.from ? base.get(g.from) : (g as EvaluationCase);
    if (!c) throw new Error(`unknown case ${g.from}`);
    return {
      case: c,
      answers: evaluationAnswers(c.evaluation),
      themes: Object.entries(g.themes).map(([key, t]) => ({ key, ...t })),
      lines: g.lines,
    };
  });
}

/**
 * The true themes of an LLM theme, by its quotes (rule fixed before the measurement): the themes
 * that more than half of its quoted answers make. A single quote of an answer with two themes
 * keeps both (a merged theme). No quote, or quotes of answers with no theme: none.
 */
export function goldThemesFor(quotes: readonly string[], answers: readonly string[], lines: readonly string[][]): string[] {
  const quoted = new Set<number>();
  for (const q of quotes) {
    const nq = normalizeForMatch(q);
    const i = answers.findIndex((a) => normalizeForMatch(a).includes(nq));
    if (i >= 0) quoted.add(i);
  }
  if (quoted.size === 0) return [];
  const tally = new Map<string, number>();
  for (const i of quoted) for (const k of lines[i] ?? []) tally.set(k, (tally.get(k) ?? 0) + 1);
  return [...tally].filter(([, n]) => n > quoted.size / 2).map(([k]) => k);
}

/** The answers that make any of `themes`, once each; null when there is nothing to compare with. */
export function goldCount(themes: readonly string[], lines: readonly string[][]): number | null {
  if (themes.length === 0) return null;
  return lines.filter((l) => l.some((k) => themes.includes(k))).length;
}

export interface ThemeRow {
  caseId: string;
  label: string;
  gold: string[];
  goldCount: number | null;
  llmCount: number;
  jev: ThemeCount;
}

export interface AnswerRow {
  caseId: string;
  theme: string;
  truth: boolean;
  verdict: MentionVerdict;
}

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "—");
const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const fmt = (x: number) => x.toFixed(2).replace(".", ",");

export function themeCountReport(input: {
  date: string;
  llmModel: string;
  jevModel: string;
  repeat: number;
  jevMs: number[];
  jevCostUsd: number;
  themes: ThemeRow[];
  perAnswer: AnswerRow[];
}): string {
  const comparable = input.themes.filter((r) => r.goldCount !== null);
  const off = (n: (r: ThemeRow) => number) => comparable.map((r) => Math.abs(n(r) - (r.goldCount ?? 0)));
  const llmOff = off((r) => r.llmCount);
  const jevOff = off((r) => r.jev.count);
  const inBand = comparable.filter(
    (r) => r.jev.count <= (r.goldCount ?? 0) && (r.goldCount ?? 0) <= r.jev.count + r.jev.unsettled,
  ).length;
  const a = input.perAnswer;
  const n = (truth: boolean, v: MentionVerdict) => a.filter((r) => r.truth === truth && r.verdict === v).length;
  const tp = n(true, "yes");
  const fp = n(false, "yes");
  const fn = n(true, "no");
  const unsettled = a.filter((r) => r.verdict === "unsettled").length;
  const unanswered = a.filter((r) => r.verdict === "unanswered").length;
  return [
    `# Jev telt de thema's van de cursusevaluatie (${input.date})`,
    "",
    `LLM-model: ${input.llmModel} · Jev: ${input.jevModel} · ${input.repeat}× per case. Drempels ${THEME_COUNT_JEV_THRESHOLDS.yes} / ${THEME_COUNT_JEV_THRESHOLDS.no} (TypeSafe's startpunt, niet afgesteld). Uitleg: \`evals/evaluation-jev/README.md\`.`,
    "",
    "## Het getal bij een thema van de LLM",
    "",
    `Thema's van de LLM: ${input.themes.length}, te vergelijken met de waarheid: ${comparable.length}, niet te vergelijken: ${input.themes.length - comparable.length} (geen citaat van een antwoord met een thema).`,
    "",
    "| Wie telt | Precies goed | Ernaast | Gemiddeld ernaast |",
    "| --- | --- | --- | --- |",
    `| LLM | ${llmOff.filter((x) => x === 0).length} | ${llmOff.filter((x) => x > 0).length} | ${fmt(mean(llmOff))} |`,
    `| Jev | ${jevOff.filter((x) => x === 0).length} | ${jevOff.filter((x) => x > 0).length} | ${fmt(mean(jevOff))} |`,
    "",
    `Waarheid binnen Jevs telling plus twijfel: ${inBand} van ${comparable.length}.`,
    "",
    "| Case | Thema van de LLM | Waarheid | LLM | Jev (+twijfel) |",
    "| --- | --- | --- | --- | --- |",
    ...input.themes.map(
      (r) =>
        `| ${r.caseId} | ${r.label.replace(/\\/g, "\\\\").replace(/\|/g, "\\|")} | ${r.goldCount ?? "—"} | ${r.llmCount} | ${r.jev.count}${r.jev.unsettled ? ` (+${r.jev.unsettled})` : ""}${r.jev.unanswered ? `, ${r.jev.unanswered} geen antwoord` : ""} |`,
    ),
    "",
    "## Jev per antwoord, op de echte thema's",
    "",
    `${a.length} vragen (antwoord × thema). Terecht ja: ${tp}, vals ja: ${fp}, gemist (nee waar het wel staat): ${fn}, twijfel: ${unsettled} (${pct(unsettled, a.length)}), geen antwoord: ${unanswered}.`,
    `Precisie ${pct(tp, tp + fp)}, gevonden ${pct(tp, a.filter((r) => r.truth).length)} van de antwoorden die het thema echt maken.`,
    "",
    "## Snelheid en kosten",
    "",
    `Jev: ${input.jevMs.length} verzoeken, gemiddeld ${Math.round(mean(input.jevMs))} ms, samen $${input.jevCostUsd.toFixed(4)}.`,
    "",
  ].join("\n");
}
