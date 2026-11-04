/**
 * Pure helpers for the portfolio-coach eval (`npm run eval:coach`): turn a case
 * into a dossier, score a checked review deterministically, and keep private
 * cases private (reports name only case ids and scores).
 */
import { readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ParseResult } from "../app/lib/portfolio/coach";
import type { DossierData, EvidenceKind, Verdict } from "../app/lib/portfolio/types";

export interface CoachCase {
  id: string;
  description?: string;
  locale: "nl" | "en";
  dossier: {
    institution: string;
    outcome: {
      code: string;
      title: string;
      criteria: { text: string; strongLevel?: string }[];
      requiredEvidence: string[];
    };
    chapter: string;
    evidence: { title: string; kind: EvidenceKind; text: string; criteria: number[] }[];
    references: string[];
    maxWords?: number;
  };
  /** Criterion number (1-based) → acceptable verdicts. */
  expected: Record<string, Verdict[]>;
  /** Criterion number → substrings, one of which must appear in evidenceNeeded. */
  expectEvidenceNeeded?: Record<string, string[]>;
  expectNoQuotes?: boolean;
}

export const OUTCOME_ID = "eval-outcome";
export const criterionId = (n: number) => `eval-c${n}`;

export function caseToDossier(c: CoachCase): DossierData {
  const o = c.dossier.outcome;
  return {
    tracks: ["bdb"],
    framework: {
      institution: c.dossier.institution,
      outcomes: [
        {
          id: OUTCOME_ID,
          code: o.code,
          title: o.title,
          criteria: o.criteria.map((cr, i) => ({ id: criterionId(i + 1), ...cr })),
          requiredEvidence: o.requiredEvidence,
        },
      ],
      requirements: c.dossier.maxWords ? { maxWords: c.dossier.maxWords } : {},
      confirmedAt: 1,
    },
    status: {},
    evidence: c.dossier.evidence.map((e, i) => ({
      id: `eval-e${i + 1}`,
      title: e.title,
      kind: e.kind,
      text: e.text,
      criterionIds: e.criteria.map(criterionId),
    })),
    chapters: [{ id: "eval-ch", outcomeId: OUTCOME_ID, text: c.dossier.chapter, aiDrafted: false }],
    references: c.dossier.references.map((apa, i) => ({ id: `eval-r${i + 1}`, apa })),
    coachMode: "coach",
    aiLog: [],
  };
}

export interface CoachScore {
  caseId: string;
  parse: boolean;
  /** 0–1: share of criteria with an acceptable verdict. */
  verdicts: number;
  unverifiedQuotes: number;
  evidenceNeeded: boolean | null;
  noQuotes: boolean | null;
  pass: boolean;
}

export function scoreCoachCase(c: CoachCase, result: ParseResult): CoachScore {
  if (!result.ok) {
    return {
      caseId: c.id,
      parse: false,
      verdicts: 0,
      unverifiedQuotes: 0,
      evidenceNeeded: c.expectEvidenceNeeded ? false : null,
      noQuotes: c.expectNoQuotes ? false : null,
      pass: false,
    };
  }
  const byN = new Map(
    result.review.criteria.map((r) => [Number(r.criterionId.replace("eval-c", "")), r]),
  );
  const keys = Object.keys(c.expected);
  const good = keys.filter((n) => {
    const r = byN.get(Number(n));
    return !!r && c.expected[n].includes(r.verdict);
  }).length;
  const verdicts = keys.length ? good / keys.length : 1;
  const unverifiedQuotes = result.review.criteria.filter((r) => r.quoteUnverified).length;
  const evidenceNeeded = c.expectEvidenceNeeded
    ? Object.entries(c.expectEvidenceNeeded).every(([n, subs]) => {
        const items = (byN.get(Number(n))?.evidenceNeeded ?? []).join(" ").toLowerCase();
        return subs.some((s) => items.includes(s.toLowerCase()));
      })
    : null;
  const noQuotes = c.expectNoQuotes
    ? result.review.criteria.every((r) => !r.quote && !r.quoteUnverified)
    : null;
  return {
    caseId: c.id,
    parse: true,
    verdicts,
    unverifiedQuotes,
    evidenceNeeded,
    noQuotes,
    pass: verdicts === 1 && unverifiedQuotes === 0 && evidenceNeeded !== false && noQuotes !== false,
  };
}

/** File names (recursively) under a directory; empty when it does not exist. */
export function fileNames(dir: string): string[] {
  if (!dir || !existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? fileNames(full) : [name];
  });
}

/** Names that occur in both lists: a private file that leaked into the repo. */
export function leakedNames(privateDir: string, repoEvalsDir: string): string[] {
  const priv = new Set(fileNames(privateDir));
  return [...new Set(fileNames(repoEvalsDir).filter((n) => priv.has(n)))];
}

export function coachReportMarkdown(input: {
  date: string;
  model: string;
  repeat: number;
  rows: (CoachScore & { private: boolean })[];
}): string {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const yesNo = (b: boolean | null) => (b === null ? "–" : b ? "ja" : "nee");
  const lines = [
    `# Eval portfoliocoach — ${input.date}`,
    "",
    `Model: ${input.model}. Herhalingen per case: ${input.repeat}. Deterministische score, geen beoordelaarsmodel.`,
    "",
    "| Case | Privé | Geparsed | Oordelen goed | Niet-letterlijke citaten | Bewijs genoemd | Geen citaten | Geslaagd |",
    "|---|---|---|---|---|---|---|---|",
    ...input.rows.map(
      (r) =>
        `| ${r.caseId} | ${r.private ? "ja" : "nee"} | ${yesNo(r.parse)} | ${pct(r.verdicts)} | ${r.unverifiedQuotes} | ${yesNo(r.evidenceNeeded)} | ${yesNo(r.noQuotes)} | ${yesNo(r.pass)} |`,
    ),
    "",
    `Geslaagd: ${input.rows.filter((r) => r.pass).length} van ${input.rows.length}.`,
    "",
  ];
  return lines.join("\n");
}
