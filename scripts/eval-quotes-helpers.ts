/**
 * Pure helpers for the quotes eval (`npm run eval:quotes`): turn a case into a dossier with one
 * feedback item, and score the checked proposal deterministically (no judge model).
 */
import { QUOTES_PROMPT_ID } from "../app/lib/portfolio/quotes";
import type { DossierData, FeedbackQuote, FeedbackRole } from "../app/lib/portfolio/types";

export interface QuotesCase {
  id: string;
  description?: string;
  locale: "nl" | "en";
  role: FeedbackRole;
  /** The criteria of one outcome, in order; `mustQuote.criterion` counts from 1. */
  criteria: string[];
  feedback: string;
  /** A quote under this criterion must contain `contains`. */
  mustQuote: { criterion: number; contains: string }[];
  /** No quote may contain any of these (vague praise, a question, an injected sentence). */
  mustNot?: string[];
  /** At most this many quotes in all. Default: no cap. */
  maxQuotes?: number;
}

const EVAL_OUTCOME = "eval-lu1";
const criterionId = (i: number) => `eval-c${i + 1}`;

export function caseToDossier(c: QuotesCase): DossierData {
  return {
    tracks: ["bdb"],
    framework: {
      institution: "Hogeschool Voorbeeld",
      confirmedAt: 1,
      outcomes: [
        {
          id: EVAL_OUTCOME,
          code: "LU1",
          title: c.locale === "en" ? "Teaching" : "Doceren",
          criteria: c.criteria.map((text, i) => ({ id: criterionId(i), text })),
          requiredEvidence: [],
        },
      ],
      requirements: {},
    },
    status: {},
    evidence: [
      { id: "eval-fb", title: "Feedback", kind: "feedback", text: c.feedback, criterionIds: [] },
    ],
    chapters: [],
    references: [],
    coachMode: "coach",
    aiLog: [],
  };
}

export interface QuotesScore {
  caseId: string;
  parse: boolean;
  quotes: number;
  /** Proposals the code dropped (not verbatim, unknown key, duplicate). Should be 0. */
  dropped: number;
  /** 0–1: share of the expected quotes found under the right criterion. */
  found: number;
  /** No quote contains vague praise, a question or an injected sentence. */
  clean: boolean;
  pass: boolean;
}

const low = (s: string) => s.toLowerCase();

export function scoreQuotesCase(
  c: QuotesCase,
  _d: DossierData,
  r: { quotes: FeedbackQuote[]; dropped: number } | null,
): Omit<QuotesScore, "caseId"> & { caseId: string } {
  if (!r) return { caseId: c.id, parse: false, quotes: 0, dropped: 0, found: 0, clean: false, pass: false };
  const hits = c.mustQuote.filter((m) =>
    r.quotes.some(
      (q) => q.criterionId === criterionId(m.criterion - 1) && low(q.text).includes(low(m.contains)),
    ),
  ).length;
  const found = c.mustQuote.length ? hits / c.mustQuote.length : 1;
  const clean = !r.quotes.some((q) => (c.mustNot ?? []).some((n) => low(q.text).includes(low(n))));
  const withinCap = c.maxQuotes === undefined || r.quotes.length <= c.maxQuotes;
  return {
    caseId: c.id,
    parse: true,
    quotes: r.quotes.length,
    dropped: r.dropped,
    found,
    clean,
    pass: found === 1 && clean && r.dropped === 0 && withinCap,
  };
}

const pct = (n: number) => `${Math.round(n * 100)} %`;

export function quotesReportMarkdown(r: {
  date: string;
  model: string;
  repeat: number;
  rows: QuotesScore[];
}): string {
  const passed = r.rows.filter((x) => x.pass).length;
  return [
    `# Eval: citaten uit feedback (${QUOTES_PROMPT_ID})`,
    "",
    `Datum: ${r.date} · model: \`${r.model}\` · herhalingen: ${r.repeat}`,
    "",
    `**${passed} van ${r.rows.length} geslaagd.** Scoring zonder rechter-model; zie \`evals/portfolio-quotes/rubric.md\`.`,
    "",
    "| case | parse | citaten | weggelaten | gevonden | schoon | geslaagd |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...r.rows.map(
      (x) =>
        `| ${x.caseId} | ${x.parse ? "ja" : "nee"} | ${x.quotes} | ${x.dropped} | ${pct(x.found)} | ${x.clean ? "ja" : "nee"} | ${x.pass ? "✓" : "×"} |`,
    ),
    "",
  ].join("\n");
}
