/**
 * Pure, dependency-free helpers for the eval harness (scripts/eval.ts).
 *
 * These are the ONLY parts of the harness unit-tested in vitest
 * (tests/lib/eval-helpers.test.ts): they must never import a prompt `?raw` file,
 * the LLM provider, or anything that touches the network — so `npm test` stays
 * offline and key-free. The runner imports both these helpers and the real
 * pipeline; the tests import only this module.
 */

/** A judge model's parsed verdict for one output. Scores are clamped to 1–5. */
export interface JudgeResult {
  scores: Record<string, number>;
  worst: string;
  verdict: string;
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
  return { scores, worst: strField("worst"), verdict: strField("verdict") };
}

/** Mean of the score values, rounded to two decimals; 0 for an empty set. */
export function averageScore(scores: Record<string, number>): number {
  const values = Object.values(scores);
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(mean * 100) / 100;
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

  const header = ["Tool", "Case", ...criteria, "Avg", "Δ vs prev", "Model", "Prompt words"];
  const sep = header.map(() => "---");

  const bodyLines = rows.map((r) => {
    const avg = averageScore(r.scores);
    const delta = formatDelta(avg, prev[reportRowKey(r)]);
    const critCells = criteria.map((c) => (r.scores[c] !== undefined ? String(r.scores[c]) : "–"));
    return [r.tool, r.caseId, ...critCells, avg.toFixed(2), delta, r.model, String(r.promptWords)];
  });

  const toRow = (cells: string[]) => `| ${cells.join(" | ")} |`;
  const lines = [
    `# Eval report — ${input.date}`,
    "",
    `Cases scored: ${rows.length}. Scores are 1–5 (higher is better); Δ compares the average to the previous report.`,
    "",
    toRow(header),
    toRow(sep),
    ...bodyLines.map(toRow),
  ];
  return lines.join("\n");
}
