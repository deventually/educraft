/**
 * Pure, dependency-free helpers for the eval harness (scripts/eval.ts).
 *
 * These are the ONLY parts of the harness unit-tested in vitest
 * (tests/lib/eval-helpers.test.ts): they must never import a prompt `?raw` file,
 * the LLM provider, or anything that touches the network — so `npm test` stays
 * offline and key-free. The runner imports both these helpers and the real
 * pipeline; the tests import only this module. (`evalGreeting` uses the app's
 * pure template helpers, which are network-free too.)
 */

import type { Tool } from "~/lib/registry/types";
import { interpolateGreeting } from "~/lib/chat/greeting";
import type { TemplateValues } from "~/lib/template/interpolate";
import { defaultValuesFor, toTemplateValues } from "~/lib/forms/values";

/** A judge model's parsed verdict for one output. Scores are clamped to 1–5. */
export interface JudgeResult {
  scores: Record<string, number>;
  /** Ids of the rubric's hard checks the judge answered `true` (the failure happened). */
  failedChecks: string[];
  worst: string;
  verdict: string;
}

/** A yes/no check from a rubric's `## Hard checks` section; a failure caps every score. */
export interface HardCheck {
  id: string;
  cap: number;
  question: string;
  /** Decided in code by {@link COUNTED_CHECKS}, never asked of the judge. */
  counted?: boolean;
}

/** One row of the eval report: a single (tool, case) output and its scores. */
export interface ReportRow {
  tool: string;
  caseId: string;
  /** criterion → 1–5 score. */
  scores: Record<string, number>;
  model: string;
  /** Word count of the built system prompt — the audit's "prompt investment". */
  promptWords: number;
  /** How many runs the scores are the mean of (default 1). */
  runs?: number;
  /** Runs the judge returned no usable verdict for; the means leave them out. */
  notJudgedRuns?: number;
  /** Lowest and highest run average, when there was more than one run. */
  spread?: [number, number];
  /** Hard checks that failed in at least one run. */
  failedChecks?: string[];
}

export interface ReportInput {
  /** Run date, passed in (scripts can't call Date.now — it breaks resume). */
  date: string;
  rows: ReportRow[];
  /** Previous report's avg per `${tool}/${caseId}` key, for the delta column. */
  previousAvgByKey?: Record<string, number>;
}

/** Clamp a raw judge score into the integer 1–5 band. */
export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(5, Math.round(n)));
}

/** Count words in a string (whitespace-delimited); 0 for empty. */
export function countWords(s: string): number {
  const trimmed = s.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * Parse a judge model's reply into a {@link JudgeResult}, tolerating ```json
 * fences and surrounding prose. Returns null on malformed input or when there is
 * no usable numeric `scores` object — the runner then records the case as
 * un-judged rather than crashing the whole run.
 */
export function parseJudgeResult(raw: string): JudgeResult | null {
  if (!raw || !raw.trim()) return null;
  const stripped = raw.replace(/```(?:json)?/gi, "");
  const first = stripped.indexOf("{");
  const last = stripped.lastIndexOf("}");
  if (first < 0 || last <= first) return null;

  let obj: unknown;
  try {
    obj = JSON.parse(stripped.slice(first, last + 1));
  } catch {
    return null;
  }
  if (typeof obj !== "object" || obj === null) return null;

  const rawScores = (obj as Record<string, unknown>).scores;
  if (typeof rawScores !== "object" || rawScores === null) return null;

  const scores: Record<string, number> = {};
  for (const [k, v] of Object.entries(rawScores as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) scores[k] = clampScore(v);
  }
  if (Object.keys(scores).length === 0) return null;

  const strField = (name: string): string => {
    const v = (obj as Record<string, unknown>)[name];
    return typeof v === "string" ? v : "";
  };
  const rawChecks = (obj as Record<string, unknown>).checks;
  const failedChecks =
    typeof rawChecks === "object" && rawChecks !== null
      ? Object.entries(rawChecks as Record<string, unknown>)
          .filter(([, v]) => v === true)
          .map(([k]) => k)
      : [];
  return { scores, failedChecks, worst: strField("worst"), verdict: strField("verdict") };
}

/**
 * Read the yes/no checks from a rubric's `## Hard checks` section, one per line:
 * `- **id** (cap N): question`. A judge scores a 1–5 scale leniently (the second
 * measurement gave an empty answer 3.6); a concrete yes/no question is far more
 * reliable (Promptbook p. 17–18), and a failed one caps the scores in code.
 */
export function parseHardChecks(rubric: string): HardCheck[] {
  const checks: HardCheck[] = [];
  let inSection = false;
  for (const line of rubric.split("\n")) {
    if (/^##\s/.test(line)) {
      inSection = /^##\s+hard checks\b/i.test(line);
      continue;
    }
    if (!inSection) continue;
    const m = /^-\s+\*\*([A-Za-z][\w-]*)\*\*\s*\(cap\s*([1-5])(,\s*counted)?\)\s*:\s*(.+)$/.exec(line.trim());
    if (m) {
      const check: HardCheck = { id: m[1], cap: Number(m[2]), question: m[4].trim() };
      if (m[3]) check.counted = true;
      checks.push(check);
    }
  }
  return checks;
}

/** The extra judge instruction for a rubric's hard checks; empty without checks. */
export function hardChecksInstruction(checks: HardCheck[]): string {
  const asked = checks.filter((c) => !c.counted);
  if (asked.length === 0) return "";
  const lines = asked.map((c) => `- "${c.id}" (cap ${c.cap}): ${c.question}`);
  return [
    'Also answer each HARD CHECK below in a "checks" object: true means the failure DID happen anywhere in the output, false means it did not. Answer from the output itself, not from intent. A turn marked "(greeting)" is fixed app text, not written by the model: ignore it for the checks.',
    ...lines,
  ].join("\n");
}

/**
 * The model's turns in a chat transcript (`**Tutor:** …`), without the fixed
 * greeting (`**Tutor (greeting):**`), which the app shows and the model never wrote.
 */
export function tutorTurns(transcript: string): string[] {
  return transcript
    .split(/\n\n(?=\*\*(?:Tutor|Student)[^*]*:\*\*)/)
    .filter((block) => block.startsWith("**Tutor:**"))
    .map((block) => block.slice("**Tutor:**".length).trim());
}

const LIST_OR_HEADING = /^\s*(?:[-*•]\s|\d+[.)]\s|#{1,6}\s|\*\*[^*\n]+:\*\*)/m;

/**
 * Checks that are counted, not judged. In meting e the judge failed "longTurn"
 * on a 118-word turn without lists, and "severalQuestions" on turns with one
 * question: what can be counted is counted.
 */
/**
 * Output budget per judge attempt. Meting g (2026-11-04): with long transcripts and six
 * hard checks, 1024 tokens cut the verdict off in 3 of 12 runs.
 */
export const JUDGE_MAX_TOKENS = [2048, 4096] as const;

/** Non-verbal cues in a role turn: `*kijkt naar de grond*` (single asterisks, not bold). */
function roleCues(turn: string): string[] {
  return [...turn.matchAll(/(?<!\*)\*(?!\*)([^*\n]+)\*(?!\*)/g)].map((m) => m[1] ?? "");
}
const FEMALE = /\b(?:zij|haar|she|her|hers)\b/i;
const MALE = /\b(?:hij|zijn|hem|he|his|him)\b/i;

export const COUNTED_CHECKS: Record<string, (transcript: string) => boolean> = {
  longTurn: (t) => tutorTurns(t).some((turn) => countWords(turn) > 150 || LIST_OR_HEADING.test(turn)),
  severalQuestions: (t) => tutorTurns(t).some((turn) => (turn.match(/\?/g) ?? []).length > 1),
  /** Role-play (P24.8): every turn in the role, i.e. all but the final feedback turn. */
  longRoleTurn: (t) =>
    tutorTurns(t)
      .slice(0, -1)
      .some((turn) => countWords(turn) > 100 || LIST_OR_HEADING.test(turn)),
  /** Role-play (#75): the cues call the same student "haar" in one turn and "zijn" in another. */
  mixedPronouns: (t) => {
    const cues = tutorTurns(t).slice(0, -1).flatMap(roleCues);
    return cues.some((c) => FEMALE.test(c)) && cues.some((c) => MALE.test(c));
  },
};

/** Ids of the counted checks that fail on this output. */
export function countedFailures(checks: HardCheck[], output: string): string[] {
  return checks.filter((c) => c.counted && COUNTED_CHECKS[c.id]?.(output)).map((c) => c.id);
}

/** Cap every score at the lowest cap among the failed checks the rubric defines. */
export function applyHardChecks(
  scores: Record<string, number>,
  failed: string[],
  checks: HardCheck[],
): Record<string, number> {
  const caps = checks.filter((c) => failed.includes(c.id)).map((c) => c.cap);
  if (caps.length === 0) return { ...scores };
  const cap = Math.min(...caps);
  return Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, Math.min(v, cap)]));
}

/**
 * The highest score an answer that hit the token limit can get. In meting d a
 * guided-reflection answer that stopped mid-text still scored 4.67: a teacher would
 * get an unfinished lesson, so the judge's scale cannot be trusted here.
 */
export const TRUNCATION_CAP = 3;

/** Cap every score of a cut-off answer at {@link TRUNCATION_CAP}. */
export function capTruncated(scores: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, Math.min(v, TRUNCATION_CAP)]));
}

/** Per-criterion mean over the judged runs (empty score sets skipped), two decimals. */
export function meanScores(runs: Record<string, number>[]): Record<string, number> {
  const judged = runs.filter((r) => Object.keys(r).length > 0);
  if (judged.length === 0) return {};
  const keys = [...new Set(judged.flatMap((r) => Object.keys(r)))];
  const out: Record<string, number> = {};
  for (const k of keys) {
    const vals = judged.map((r) => r[k]).filter((v): v is number => v !== undefined);
    out[k] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
  }
  return out;
}

/** Lowest and highest run average over the judged runs; undefined when none. */
export function runSpread(runs: Record<string, number>[]): [number, number] | undefined {
  const avgs = runs.filter((r) => Object.keys(r).length > 0).map(averageScore);
  if (avgs.length === 0) return undefined;
  return [Math.min(...avgs), Math.max(...avgs)];
}

/** Mean of the score values, rounded to two decimals; 0 for an empty set. */
export function averageScore(scores: Record<string, number>): number {
  const values = Object.values(scores);
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(mean * 100) / 100;
}

/** Average per scored case, keyed for the next run's Δ; a case that was not judged is left out. */
export function scoresForNextRun(rows: ReportRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) if (Object.keys(r.scores).length > 0) out[reportRowKey(r)] = averageScore(r.scores);
  return out;
}

/** A signed 2-decimal delta vs the previous avg, or an em dash when none. */
export function formatDelta(current: number, previous: number | undefined): string {
  if (previous === undefined) return "—";
  const diff = current - previous;
  return diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
}

/** Stable key for a report row / previous-avg lookup. */
export function reportRowKey(row: Pick<ReportRow, "tool" | "caseId">): string {
  return `${row.tool}/${row.caseId}`;
}

/**
 * Render the per tool × case scores table as deterministic Markdown, with a
 * per-criterion column, an average, a delta vs the previous report, and the run
 * metadata (model, prompt word count). Rows are sorted by (tool, case) so the
 * output is stable regardless of input order.
 */
export function buildReportMarkdown(input: ReportInput): string {
  const prev = input.previousAvgByKey ?? {};
  const rows = [...input.rows].sort(
    (a, b) => a.tool.localeCompare(b.tool) || a.caseId.localeCompare(b.caseId),
  );
  const criteria = [...new Set(rows.flatMap((r) => Object.keys(r.scores)))].sort();

  const header = [
    "Tool",
    "Case",
    ...criteria,
    "Avg",
    "Δ vs prev",
    "Runs",
    "Failed checks",
    "Model",
    "Prompt words",
  ];
  const runsCell = (r: ReportRow) => {
    const notes = [
      ...(r.spread ? [`${r.spread[0].toFixed(2)}–${r.spread[1].toFixed(2)}`] : []),
      ...(r.notJudgedRuns ? [`${r.notJudgedRuns} not judged`] : []),
    ];
    return notes.length ? `${r.runs ?? 1} (${notes.join("; ")})` : String(r.runs ?? 1);
  };
  const checksCell = (r: ReportRow) => (r.failedChecks?.length ? r.failedChecks.join(", ") : "—");
  const sep = header.map(() => "---");

  const bodyLines = rows.map((r) => {
    const avg = averageScore(r.scores);
    if (Object.keys(r.scores).length === 0) {
      const empty = criteria.map(() => "–");
      return [
        r.tool,
        r.caseId,
        ...empty,
        "not judged",
        "—",
        runsCell(r),
        "—",
        r.model,
        String(r.promptWords),
      ];
    }
    const delta = formatDelta(avg, prev[reportRowKey(r)]);
    const critCells = criteria.map((c) => (r.scores[c] !== undefined ? String(r.scores[c]) : "–"));
    return [
      r.tool,
      r.caseId,
      ...critCells,
      avg.toFixed(2),
      delta,
      runsCell(r),
      checksCell(r),
      r.model,
      String(r.promptWords),
    ];
  });

  const scored = rows.filter((r) => Object.keys(r.scores).length > 0).length;
  const toRow = (cells: string[]) => `| ${cells.join(" | ")} |`;
  const lines = [
    `# Eval report — ${input.date}`,
    "",
    `Cases scored: ${scored} of ${rows.length}. Scores are 1–5 (higher is better); Δ compares the average to the previous report.`,
    "",
    toRow(header),
    toRow(sep),
    ...bodyLines.map(toRow),
  ];
  return lines.join("\n");
}

/**
 * The chat greeting as the app shows it: placeholders such as `{{subject}}` filled
 * from the case values (`interpolateGreeting`, the app's own helper). Before this,
 * the transcript showed a literal `{{subject}}` (nulmeting 2026-11-04).
 */
export function evalGreeting(
  tool: Tool,
  c: { outputLanguage: "nl" | "en"; values?: Record<string, unknown> },
): string | undefined {
  const greeting = tool.chat?.greeting;
  if (!greeting) return undefined;
  const text = typeof greeting === "string" ? greeting : greeting[c.outputLanguage];
  return interpolateGreeting(text, (c.values ?? {}) as TemplateValues);
}

/**
 * Why an output must not go to the judge, or null when it may. In the second
 * measurement (2026-11-04) guided-reflection eqf6 came back empty and the judge
 * still gave it 3.6: a judge scores whatever it gets, so an empty answer is
 * refused here and reported as not judged.
 */
export function unjudgeableReason(output: string): string | null {
  if (!output.trim()) return "empty output";
  if (/\*\*Tutor:\*\*[ \t]*(?:\n\s*(?=\*\*Student:\*\*)|\s*$)/.test(output)) return "empty tutor turn";
  return null;
}

/**
 * A case's template values on top of the form's defaults, as the app sends them: the
 * form starts from `defaultValuesFor`, so an optional field a case leaves out is empty
 * rather than a missing placeholder.
 */
export function caseValues(tool: Tool, values: TemplateValues | undefined): TemplateValues {
  return { ...toTemplateValues(defaultValuesFor(tool.inputs)), ...(values ?? {}) };
}

/** The judge's JSON for one run, saved next to its output (`<case>.judge.json`, `<case>.run2.judge.json`). */
export function judgeFileName(caseId: string, run: number): string {
  return run === 1 ? `${caseId}.judge.json` : `${caseId}.run${run}.judge.json`;
}

/** What the judge said about one run: enough to see why a score is below 5. */
export function judgeRecord(j: {
  scores: Record<string, number>;
  failedChecks?: string[];
  worst: string;
  verdict: string;
}): string {
  return `${JSON.stringify(
    { scores: j.scores, failedChecks: j.failedChecks ?? [], worst: j.worst, verdict: j.verdict },
    null,
    2,
  )}\n`;
}
