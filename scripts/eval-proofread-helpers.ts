/**
 * Pure helpers for the proofreading eval (`npm run eval:proofread`): turn a
 * case into a dossier and score the checked proposals deterministically.
 */
import type { ProofreadParseResult } from "../app/lib/portfolio/proofread";
import type { DossierData } from "../app/lib/portfolio/types";
import { OUTCOME_ID } from "./eval-coach-helpers";

export interface ProofreadCase {
  id: string;
  description?: string;
  locale: "nl" | "en";
  chapter: string;
  references: string[];
  /** Planted errors: a proposal's quote must contain `span`, and its suggestion one of `fix`. */
  mustFlag?: { span: string; fix?: string[] }[];
  /** Facts that a proposal touching them must keep (no invented or changed content). */
  keep?: string[];
  /** At most this many proposals (a clean chapter gets few). Default 12. */
  maxSuggestions?: number;
}

export function caseToDossier(c: ProofreadCase): DossierData {
  return {
    tracks: ["bdb"],
    framework: {
      institution: "Hogeschool Voorbeeld",
      outcomes: [
        {
          id: OUTCOME_ID,
          code: "LU1",
          title: "Doceren",
          criteria: [{ id: "eval-c1", text: "Je verzorgt een les en verantwoordt je keuzes." }],
          requiredEvidence: [],
        },
      ],
      requirements: {},
    },
    status: {},
    evidence: [],
    chapters: [{ id: "eval-ch", outcomeId: OUTCOME_ID, text: c.chapter, aiDrafted: false }],
    references: c.references.map((apa, i) => ({ id: `eval-r${i + 1}`, apa })),
    coachMode: "coach",
    aiLog: [],
  };
}

export interface ProofreadScore {
  caseId: string;
  parse: boolean;
  suggestions: number;
  /** Proposals the code dropped (quote not literal, no-op, unknown source). Should be 0. */
  dropped: number;
  /** 0–1: share of planted errors a proposal points at. */
  found: number;
  /** 0–1: share of planted errors with a fix whose proposal contains it. */
  fixed: number;
  keptIntact: boolean;
  pass: boolean;
}

const low = (s: string) => s.replace(/\s+/g, " ").toLowerCase();

export function scoreProofreadCase(c: ProofreadCase, r: ProofreadParseResult): ProofreadScore {
  const flags = c.mustFlag ?? [];
  if (!r.ok) {
    return {
      caseId: c.id,
      parse: false,
      suggestions: 0,
      dropped: 0,
      found: 0,
      fixed: 0,
      keptIntact: true,
      pass: false,
    };
  }
  const hit = (span: string) => r.suggestions.find((s) => low(s.quote).includes(low(span)));
  const found = flags.filter((f) => hit(f.span)).length;
  const withFix = flags.filter((f) => f.fix);
  const fixed = withFix.filter((f) => {
    const s = hit(f.span);
    return !!s && (f.fix ?? []).some((x) => low(s.suggestion).includes(low(x)));
  }).length;
  const keptIntact = (c.keep ?? []).every((k) =>
    r.suggestions.every((s) => !low(s.quote).includes(low(k)) || low(s.suggestion).includes(low(k))),
  );
  const share = (n: number, of: number) => (of ? n / of : 1);
  const score = {
    caseId: c.id,
    parse: true,
    suggestions: r.suggestions.length,
    dropped: r.dropped,
    found: share(found, flags.length),
    fixed: share(fixed, withFix.length),
    keptIntact,
  };
  return {
    ...score,
    pass:
      score.found === 1 &&
      score.fixed === 1 &&
      score.dropped === 0 &&
      keptIntact &&
      score.suggestions <= (c.maxSuggestions ?? 12),
  };
}

export function proofreadReportMarkdown(input: {
  date: string;
  model: string;
  repeat: number;
  rows: ProofreadScore[];
}): string {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const yesNo = (b: boolean) => (b ? "ja" : "nee");
  return [
    `# Eval proeflezer — ${input.date}`,
    "",
    `Model: ${input.model}. Herhalingen per case: ${input.repeat}. Deterministische score, geen beoordelaarsmodel.`,
    "",
    "| Case | Geparsed | Voorstellen | Weggevallen | Gevonden | Goed verbeterd | Feiten intact | Geslaagd |",
    "|---|---|---|---|---|---|---|---|",
    ...input.rows.map(
      (r) =>
        `| ${r.caseId} | ${yesNo(r.parse)} | ${r.suggestions} | ${r.dropped} | ${pct(r.found)} | ${pct(r.fixed)} | ${yesNo(r.keptIntact)} | ${yesNo(r.pass)} |`,
    ),
    "",
    `Geslaagd: ${input.rows.filter((r) => r.pass).length} van ${input.rows.length}.`,
    "",
  ].join("\n");
}
