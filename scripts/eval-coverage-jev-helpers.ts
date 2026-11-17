/**
 * Jev's check of the course import's tests (`app/lib/courses/coverageJev.ts`): the cases, the
 * scoring of one run and the report. Pure; `scripts/eval-coverage-jev.ts` makes the calls.
 *
 * The question is not "is Jev better than the LLM" but the one TypeSafe's verify-and-escalate
 * cookbook asks: of the LLM's mistakes, how many does Jev mark (caught), and of its right
 * answers, how many does it mark for nothing (false alarm)?
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { COVERAGE_JEV_THRESHOLDS, type CoverageJevAnswer } from "~/lib/courses/coverageJev";
import type { ImportAssessment, ImportProposal } from "~/lib/courses/import";
import type { AssessmentKind } from "~/lib/courses/types";
import { normalizeForMatch } from "~/lib/documents/locate";
import type { Locale } from "~/lib/i18n";
import { EVALS_DIR } from "./eval-files";

export interface CoverageCase {
  id: string;
  locale: Locale;
  courseName: string;
  description: string;
  document: string;
  outcomes: string[];
  /** What the document says: the kind, and the outcomes covered (1-based). */
  assessments: { title: string; kind: AssessmentKind; covers: number[] }[];
}

export function loadCoverageCases(): CoverageCase[] {
  const file = join(EVALS_DIR, "coverage-jev", "cases.json");
  return (JSON.parse(readFileSync(file, "utf8")) as { cases: CoverageCase[] }).cases;
}

export interface PairRow {
  case: string;
  run: number;
  test: string;
  /** 1-based, as in the case. */
  outcome: number;
  truth: boolean;
  llm: boolean;
  jevP?: number;
  marked: boolean;
}

export interface KindRow {
  case: string;
  run: number;
  test: string;
  truth: AssessmentKind;
  llm?: AssessmentKind;
  /** The kind after Jev (it fills one the LLM left open). */
  final?: AssessmentKind;
  jevP?: number;
  marked: boolean;
}

export interface CoverageRun {
  pairs: PairRow[];
  kinds: KindRow[];
  /** Labelled tests the LLM did not find. */
  missing: string[];
}

const key = (s: string) => normalizeForMatch(s).replace(/[.;:]$/, "");
const sameTest = (a: string, b: string) => key(a).includes(key(b)) || key(b).includes(key(a));

/** One run: the LLM's proposal, and per test key Jev's answer and the test after the verdict. */
export function scoreCoverageRun(
  c: CoverageCase,
  run: number,
  proposal: ImportProposal,
  jev: Map<string, { answer: CoverageJevAnswer; checked: ImportAssessment }>,
): CoverageRun {
  const out: CoverageRun = { pairs: [], kinds: [], missing: [] };
  const outcomeKey = c.outcomes.map(
    (o) => proposal.outcomes.find((p) => key(p.text) === key(o))?.key,
  );
  for (const t of c.assessments) {
    const a = proposal.assessments.find((p) => sameTest(p.title, t.title));
    if (!a) {
      out.missing.push(t.title);
      continue;
    }
    const j = jev.get(a.key);
    const after = j?.checked ?? a;
    c.outcomes.forEach((_, i) => {
      const k = outcomeKey[i];
      const jevP = k ? j?.answer.covers[k] : undefined;
      out.pairs.push({
        case: c.id,
        run,
        test: t.title,
        outcome: i + 1,
        truth: t.covers.includes(i + 1),
        llm: k !== undefined && a.outcomeKeys.includes(k),
        ...(jevP !== undefined ? { jevP } : {}),
        marked: k !== undefined && (after.check?.outcomeKeys.includes(k) ?? false),
      });
    });
    const jevP = j?.answer.summative;
    out.kinds.push({
      case: c.id,
      run,
      test: t.title,
      truth: t.kind,
      ...(a.kind ? { llm: a.kind } : {}),
      ...(after.kind ? { final: after.kind } : {}),
      ...(jevP !== undefined ? { jevP } : {}),
      marked: after.check?.kind ?? false,
    });
  }
  return out;
}

const pct = (n: number, d: number) => (d === 0 ? "–" : `${n}/${d} (${Math.round((100 * n) / d)}%)`);

/** Jev's own answer on the threshold: right, wrong or unsettled (or absent). */
function alone(rows: { p?: number; truth: boolean }[]) {
  const { yes, no } = COVERAGE_JEV_THRESHOLDS;
  let right = 0;
  let wrong = 0;
  let unsettled = 0;
  for (const r of rows) {
    if (r.p === undefined || (r.p > no && r.p < yes)) unsettled++;
    else if (r.p >= yes === r.truth) right++;
    else wrong++;
  }
  return `${right} / ${wrong} / ${unsettled}`;
}

function table(rows: { llmRight: boolean; marked: boolean; p?: number; truth: boolean }[]) {
  const wrong = rows.filter((r) => !r.llmRight);
  const right = rows.filter((r) => r.llmRight);
  return [
    "| | |",
    "| --- | --- |",
    `| Gescoord | ${rows.length} |`,
    `| fouten van de LLM | ${wrong.length} |`,
    `| daarvan gemarkeerd (gevangen) | ${pct(wrong.filter((r) => r.marked).length, wrong.length)} |`,
    `| goede LLM-antwoorden gemarkeerd (vals alarm) | ${pct(right.filter((r) => r.marked).length, right.length)} |`,
    `| Jev alleen: goed / fout / onbeslist | ${alone(rows)} |`,
  ].join("\n");
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s[Math.floor(s.length / 2)] ?? 0) : 0;
};

export function coverageReport(input: {
  date: string;
  llmModel: string;
  jevModel: string;
  repeat: number;
  jevMs: number[];
  jevCostUsd: number;
  runs: CoverageRun[];
}): string {
  const pairs = input.runs.flatMap((r) => r.pairs);
  const kinds = input.runs.flatMap((r) => r.kinds);
  const missing = input.runs.flatMap((r) => r.missing);
  return [
    `# Jev controleert dekking en soort toets bij de import (${input.date})`,
    "",
    `LLM \`${input.llmModel}\`, Jev \`${input.jevModel}\`, ${input.repeat}× per case. Drempels ${COVERAGE_JEV_THRESHOLDS.yes} / ${COVERAGE_JEV_THRESHOLDS.no} (TypeSafe's startpunt, niet afgesteld). Uitleg: \`evals/coverage-jev/README.md\`.`,
    "",
    "## Dekking (toets × leeruitkomst)",
    "",
    table(pairs.map((r) => ({ llmRight: r.llm === r.truth, marked: r.marked, p: r.jevP, truth: r.truth }))),
    "",
    "## Soort (formatief of summatief)",
    "",
    table(
      kinds.map((r) => ({
        llmRight: r.llm === r.truth,
        marked: r.marked,
        p: r.jevP,
        truth: r.truth === "summative",
      })),
    ),
    "",
    `Soort na Jev goed (Jev vult een open soort): ${pct(kinds.filter((r) => r.final === r.truth).length, kinds.length)}.`,
    "",
    "## Snelheid en kosten",
    "",
    `Jev: ${input.jevMs.length} verzoeken, mediaan ${median(input.jevMs)} ms, samen $${input.jevCostUsd.toFixed(4)}.`,
    "",
    missing.length
      ? `Toetsen die de LLM niet vond (niet gescoord): ${missing.length} (${[...new Set(missing)].join(", ")}).`
      : "De LLM vond elke gelabelde toets.",
    "",
  ].join("\n");
}
