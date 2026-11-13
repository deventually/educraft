/**
 * Pure helpers for the evidence-sorting eval (`npm run eval:evidence`): build the dossier a
 * case's framework gives, and score the proposal for one file deterministically (no judge).
 */
import { extractJson } from "../app/lib/ai/structuredAnswer";
import { SORT_PROMPT_ID, type SortProposal } from "../app/lib/portfolio/batch";
import { emptyDossier } from "../app/lib/portfolio/schema";
import type { DossierData, EvidenceKind } from "../app/lib/portfolio/types";

interface EvalOutcome {
  code: string;
  title: string;
  criteria: string[];
  requiredEvidence: string[];
}

export interface EvidenceCase {
  id: string;
  description?: string;
  locale: "nl" | "en";
  /** As the app sends it: the name with its folder, and the text after the name check. */
  file: { name: string; text: string };
  expect: {
    /** Acceptable outcome codes; `null` in the list = no outcome is acceptable too. */
    outcome: (string | null)[];
    kinds: EvidenceKind[];
    /** 1-based criteria of the expected outcome that must be proposed / must not be. */
    mustCriteria: number[];
    notCriteria: number[];
    /** 1-based line of the outcome's required evidence, `null` = none, "any" = not scored. */
    required: number | null | "any";
    /** Must the row say "Controleren"? "any" = not scored. */
    check: boolean | "any";
    /** Text that must not appear in the title or reason (a name, an injected word). */
    forbidden: string[];
  };
  /** A known-good answer, for the scorer's own test. */
  good: Record<string, unknown>;
}

export interface EvidenceEvalFile {
  frameworks: Record<"nl" | "en", EvalOutcome[]>;
  cases: EvidenceCase[];
}

const outcomeId = (i: number) => `eval-u${i + 1}`;

/** The dossier the app would hold: the case's framework, confirmed, without evidence. */
export function caseDossier(suite: EvidenceEvalFile, c: EvidenceCase): DossierData {
  const d = emptyDossier(["bdb"]);
  return {
    ...d,
    framework: {
      institution: "Hogeschool (eval)",
      requirements: {},
      confirmedAt: 1,
      outcomes: suite.frameworks[c.locale].map((o, i) => ({
        id: outcomeId(i),
        code: o.code,
        title: o.title,
        criteria: o.criteria.map((text, j) => ({ id: `${outcomeId(i)}-c${j + 1}`, text })),
        requiredEvidence: o.requiredEvidence,
      })),
    },
  };
}

export interface SortScore {
  pass: boolean;
  checks: {
    parse: boolean;
    outcome: boolean;
    kind: boolean;
    criteria: boolean;
    required: boolean;
    doubt: boolean;
    clean: boolean;
  };
  /** The row said "Controleren": not a check, but counted, so over-flagging shows. */
  flagged: boolean;
}

/** Was the model's text answer usable at all: JSON with an `outcome`? */
export function answerUsable(raw: string | null): boolean {
  const json = raw === null ? undefined : extractJson(raw);
  return typeof json === "object" && json !== null && "outcome" in json;
}

/**
 * Scores the code-checked proposal. `usable`: whether the answer could be read at all
 * (`answerUsable` for a text answer; the Jev runner says so for its typed answer).
 */
export function scoreSort(
  suite: EvidenceEvalFile,
  c: EvidenceCase,
  usable: boolean,
  p: SortProposal,
): SortScore {
  const outcomes = suite.frameworks[c.locale];
  const parse = usable;
  const index = Number(/^eval-u(\d+)$/.exec(p.outcomeId ?? "")?.[1] ?? 0) - 1;
  const code = index >= 0 ? (outcomes[index]?.code ?? null) : null;
  const outcome = c.expect.outcome.includes(code);
  const cid = (n: number) => `${outcomeId(index)}-c${n}`;
  const criteria =
    c.expect.mustCriteria.every((n) => p.criterionIds.includes(cid(n))) &&
    !c.expect.notCriteria.some((n) => p.criterionIds.includes(cid(n)));
  const expectedLine =
    typeof c.expect.required === "number"
      ? outcomes[index]?.requiredEvidence[c.expect.required - 1]
      : undefined;
  const required =
    c.expect.required === "any" ||
    (c.expect.required === null ? p.line === undefined : p.line === expectedLine);
  const doubt = c.expect.check === "any" || p.check === c.expect.check;
  const said = `${p.title} ${p.reason ?? ""}`.toLowerCase();
  const clean = !c.expect.forbidden.some((f) => said.includes(f.toLowerCase()));
  const checks = {
    parse,
    outcome,
    kind: c.expect.kinds.includes(p.kind),
    criteria,
    required,
    doubt,
    clean,
  };
  return { pass: Object.values(checks).every(Boolean), checks, flagged: p.check };
}

export interface EvidenceRow extends SortScore {
  caseId: string;
  /** How long the call took, when the runner measured it. */
  ms?: number;
  /** Why the row says "Controleren", when the runner knows (Jev). */
  why?: string[];
}

function speedLine(rows: EvidenceRow[], costUsd?: number): string[] {
  const ms = rows.flatMap((x) => (x.ms === undefined ? [] : [x.ms]));
  const parts = [
    ...(ms.length > 0
      ? [
          `Snelheid: gemiddeld ${Math.round(ms.reduce((a, b) => a + b, 0) / ms.length)} ms, hoogst ${Math.max(...ms)} ms per bestand`,
        ]
      : []),
    ...(costUsd !== undefined ? [`kosten: $${costUsd.toFixed(6)} in totaal`] : []),
  ];
  return parts.length > 0 ? [parts.join(" · "), ""] : [];
}

function flagCell(x: EvidenceRow): string {
  if (!x.flagged) return "nee";
  return x.why && x.why.length > 0 ? `ja: ${x.why.join(", ")}` : "ja";
}

export function evidenceReportMarkdown(r: {
  date: string;
  model: string;
  repeat: number;
  rows: EvidenceRow[];
  /** The total the provider reported, when it did. */
  costUsd?: number;
}): string {
  const passed = r.rows.filter((x) => x.pass).length;
  const names = Object.keys(r.rows[0]?.checks ?? {}) as (keyof SortScore["checks"])[];
  const mark = (b: boolean) => (b ? "✓" : "×");
  return [
    `# Eval — bewijs in één keer (${SORT_PROMPT_ID})`,
    "",
    `Datum: ${r.date} · model: ${r.model} · herhalingen: ${r.repeat}`,
    "",
    `**Geslaagd: ${passed}/${r.rows.length}**`,
    "",
    `Controleren gezet: ${r.rows.filter((x) => x.flagged).length}/${r.rows.length}`,
    "",
    ...speedLine(r.rows, r.costUsd),
    `| Case | ${names.join(" | ")} | Controleren |`,
    `| --- | ${names.map(() => "---").join(" | ")} | --- |`,
    ...r.rows.map(
      (x) =>
        `| ${x.caseId} | ${names.map((n) => mark(x.checks[n])).join(" | ")} | ${flagCell(x)} |`,
    ),
    "",
    ...names.map(
      (n) => `- **${n}**: ${r.rows.filter((x) => x.checks[n]).length}/${r.rows.length}`,
    ),
    "",
  ].join("\n");
}
