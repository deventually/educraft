/**
 * The leak set (anonymiseerpoort, PR 1): fictitious texts with planted names, numbers and
 * addresses (`mustGo`) and words that must stay (`mustStay`: researchers, ordinary words that a
 * name shares). Plain code, no model: it counts what slips through and what was wrongly
 * replaced, and renders the report Bastiaan reads in a few seconds (wrongly replaced on top).
 * The sets live in `evals/privacy-leakset/`; the rules are tuned on `tuning.json` only.
 */
import { redactOptions } from "~/lib/privacy/pack";
import { findRedactions, type RedactEntry, type RedactSpan } from "~/lib/privacy/redact";

export interface LeakCase {
  id: string;
  kind: "werkplaats" | "studentwerk" | "bestanden";
  text: string;
  /** What the teacher (or, later, the server) names. */
  entries: RedactEntry[];
  extra?: string[];
  /** The student number the teacher typed, as an example of the format. */
  studentNumberExample?: string;
  /**
   * Exact substrings that must be gone, every occurrence. `{ value, in }` checks `value` only
   * where it stands in the context `in` ("Iris" in "Iris bedacht", not in "Iris als bloem").
   */
  mustGo: Array<string | { value: string; in: string }>;
  /** Whole words (case-sensitive) that must stay, every occurrence outside a `mustGo` value. */
  mustStay: string[];
}

type Verdict = "wrong" | "unlabelled" | "intended";

interface Row {
  word: string;
  code: string;
  count: number;
  caseIds: string[];
  verdict: Verdict;
}

export interface LeakResult {
  leaks: { caseId: string; value: string }[];
  wrong: { caseId: string; value: string; code: string }[];
  rows: Row[];
  totals: { mustGo: number; mustStay: number };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function occurrences(text: string, value: string, wholeWord: boolean): number[] {
  const re = wholeWord
    ? new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(value)}(?![\\p{L}\\p{N}])`, "gu")
    : new RegExp(escapeRe(value), "g");
  return [...text.matchAll(re)].map((m) => m.index ?? 0);
}

const covered = (spans: RedactSpan[], at: number) => spans.some((s) => s.start <= at && at < s.end);
const overlaps = (s: RedactSpan, start: number, end: number) => s.start < end && start < s.end;

/** Scores every case; a name is gone only when each of its letters and digits is covered. */
export function scoreLeakset(cases: LeakCase[]): LeakResult {
  const leaks: LeakResult["leaks"] = [];
  const wrong: LeakResult["wrong"] = [];
  const rows = new Map<string, Row & { flags: Set<Verdict> }>();
  const totals = { mustGo: 0, mustStay: 0 };

  for (const c of cases) {
    const options = redactOptions({ studentNumberExample: c.studentNumberExample });
    const spans = findRedactions(c.text, c.entries, c.extra ?? [], options);
    const goes: Array<[number, number]> = [];
    const stays: Array<[number, number]> = [];

    for (const planted of c.mustGo) {
      const { value, in: context } = typeof planted === "string" ? { value: planted, in: planted } : planted;
      const offset = context.indexOf(value);
      for (const at of occurrences(c.text, context, false).map((i) => i + offset)) {
        totals.mustGo++;
        goes.push([at, at + value.length]);
        const chars = [...value].map((ch, i) => [ch, at + i] as const);
        const slips = chars.some(([ch, i]) => /[\p{L}\p{N}]/u.test(ch) && !covered(spans, i));
        if (slips && !leaks.some((l) => l.caseId === c.id && l.value === context)) {
          leaks.push({ caseId: c.id, value: context });
        }
      }
    }
    for (const value of c.mustStay) {
      for (const at of occurrences(c.text, value, true)) {
        // "Bloom" inside the name "Lisa Bloom" goes with the name.
        if (goes.some(([a, b]) => a <= at && at + value.length <= b)) continue;
        totals.mustStay++;
        stays.push([at, at + value.length]);
        const hit = spans.find((s) => overlaps(s, at, at + value.length));
        if (hit) wrong.push({ caseId: c.id, value, code: hit.code });
      }
    }

    for (const s of spans) {
      const key = `${s.original}\u0000${s.code}`;
      const row = rows.get(key) ?? {
        word: s.original,
        code: s.code,
        count: 0,
        caseIds: [],
        verdict: "unlabelled" as Verdict,
        flags: new Set<Verdict>(),
      };
      row.count++;
      if (!row.caseIds.includes(c.id)) row.caseIds.push(c.id);
      if (stays.some(([a, b]) => overlaps(s, a, b))) row.flags.add("wrong");
      else if (goes.some(([a, b]) => overlaps(s, a, b))) row.flags.add("intended");
      rows.set(key, row);
    }
  }

  const order: Verdict[] = ["wrong", "unlabelled", "intended"];
  const list = [...rows.values()].map(({ flags, ...row }) => ({
    ...row,
    verdict: flags.has("wrong") ? "wrong" : flags.has("intended") ? "intended" : ("unlabelled" as Verdict),
  }));
  list.sort(
    (a, b) =>
      order.indexOf(a.verdict) - order.indexOf(b.verdict) ||
      b.count - a.count ||
      a.word.localeCompare(b.word),
  );
  return { leaks, wrong, rows: list, totals };
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch);

const VERDICT: Record<Verdict, string> = {
  wrong: "Onterecht",
  unlabelled: "Niet benoemd",
  intended: "Bedoeld",
};

function table(head: string[], body: string[][], cls = ""): string {
  if (!body.length) return `<p class="none">Geen.</p>`;
  const th = head.map((h) => `<th scope="col">${esc(h)}</th>`).join("");
  const tr = body.map((cells) => `<tr${cls}>${cells.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`);
  return `<table><thead><tr>${th}</tr></thead><tbody>${tr.join("")}</tbody></table>`;
}

function section(name: string, r: LeakResult): string {
  const rows = r.rows.map(
    (row) =>
      `<tr class="${row.verdict}"><td>${esc(row.word)}</td><td><code>[${esc(row.code)}]</code></td><td>${row.count}</td><td>${esc(row.caseIds.join(", "))}</td><td>${VERDICT[row.verdict]}</td></tr>`,
  );
  const all = rows.length
    ? `<table><thead><tr><th scope="col">Woord</th><th scope="col">Code</th><th scope="col">Hoe vaak</th><th scope="col">In tekst</th><th scope="col">Bedoeling</th></tr></thead><tbody>${rows.join("")}</tbody></table>`
    : `<p class="none">Geen.</p>`;
  return `<section><h2>${esc(name)}</h2>
<p class="sum">${r.wrong.length} van ${r.totals.mustStay} woorden die moesten blijven staan zijn vervangen; ${r.leaks.length} geplante waarden glipten erdoor (van ${r.totals.mustGo} plekken).</p>
<h3>Onterecht vervangen</h3>
${table(
  ["Woord", "Code", "In tekst"],
  r.wrong.map((w) => [w.value, `[${w.code}]`, w.caseId]),
  ' class="wrong"',
)}
<h3>Doorgeglipt</h3>
${table(
  ["Waarde", "In tekst"],
  r.leaks.map((l) => [l.value, l.caseId]),
  ' class="leak"',
)}
<h3>Alle vervangen woorden</h3>
${all}
</section>`;
}

/** One self-contained page: per set the wrongly replaced words first, then the leaks, then all. */
export function leaksetHtml(sets: { name: string; result: LeakResult }[], date: string): string {
  return `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lekset anonimiseren</title>
<style>
:root{--bg:#fff;--fg:#1e293b;--muted:#64748b;--line:#e2e8f0;--wrong:#fee2e2;--leak:#fef3c7;--ok:#f0fdf4}
@media (prefers-color-scheme:dark){:root{--bg:#0f172a;--fg:#e2e8f0;--muted:#94a3b8;--line:#334155;--wrong:#7f1d1d;--leak:#78350f;--ok:#14532d}}
body{background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif;margin:0 auto;max-width:960px;padding:16px}
table{border-collapse:collapse;width:100%;margin:8px 0 24px;display:block;overflow-x:auto}
th,td{border-bottom:1px solid var(--line);padding:4px 8px;text-align:left;vertical-align:top}
tr.wrong td{background:var(--wrong);font-weight:600}tr.leak td{background:var(--leak)}tr.intended td{background:var(--ok)}
.sum,.none{color:var(--muted)}code{font-size:13px}
</style></head><body>
<h1>Lekset anonimiseren</h1>
<p class="sum">${esc(date)} · fictieve teksten, gewone code, geen model. Bovenaan wat niet vervangen had mogen worden.</p>
${sets.map((s) => section(s.name, s.result)).join("\n")}
</body></html>
`;
}
