/**
 * "Evidence in one go" with TypeSafe's Jev (a decision model, not an LLM): the sort of one file
 * as typed decisions, through OpenRouter's Decisions API. Pure: the request and the reading of
 * the answer; the call is `app/server/portfolioBatch.server.ts`, behind the instance setting
 * `evidenceJev`.
 *
 * Built to TypeSafe's skill (commit 302eea6) and docs, and measured against the LLM on the eval
 * (`npm run eval:evidence -- --jev`, which builds its requests with this module, so it measures
 * what the app sends):
 * - judgments from Jev, the decision in code (the truth table in `parseJevAnswer`);
 * - state as named fields, with the facts code knows (what the dossier is, what the text is);
 * - one judgment per question; a compound criterion can be asked per part (`parts`; the app
 *   asks each criterion whole);
 * - the null case as a companion yes/no ("is this evidence?"), not a "none" option;
 * - descriptive option names, option descriptions that say what they cover and exclude,
 *   questions that name the state by its path;
 * - thresholds 0.7 / 0.3 as TypeSafe's starting points, the band between with its own row;
 * - the option order can be rotated, against Jev's lean toward the first option.
 *
 * Jev writes no text: the title is the file's own name and there is no reason line.
 */
import { z } from "zod";
import { BATCH_LIMITS, baseName, type SortProposal } from "./batch";
import { JEV_TEXT, type Locale } from "./sortJevText";
import { type DossierData, EVIDENCE_KINDS, type EvidenceKind } from "./types";

export interface JevThresholds {
  /** The chosen outcome's probability from which it needs no check. */
  outcomeSure: number;
  /** The same for the kind. */
  kindSure: number;
  /** A yes/no counts as yes from here, … */
  yes: number;
  /** … as no up to here; in between it is unsettled. */
  no: number;
  /** Does an unsettled criterion or line of the chosen outcome set "Controleren"? */
  unsettled: boolean;
}

/**
 * TypeSafe's starting thresholds (0.7 / 0.3), the same for a choice's top option. The truth
 * table gives the unsettled band of a criterion its own row: not proposed, no check (the teacher
 * ticks every criterion anyway); an unsettled "is this evidence?" is a check.
 */
export const JEV_THRESHOLDS: JevThresholds = {
  outcomeSure: 0.7,
  kindSure: 0.7,
  yes: 0.7,
  no: 0.3,
  unsettled: false,
};

type Criteria = Record<string, string | Record<string, unknown>>;

interface JevQuestion {
  type: "choice" | "noul";
  instructions: string;
  criteria?: Criteria;
}

export interface JevRequest {
  model: string;
  state: {
    dossier: string;
    file: { folder: string; name: string; text: string };
    about_text: string;
  };
  questions: Record<string, JevQuestion>;
}

/** Criterion text → its atomic parts (one judgment each). Absent: the criterion is one part. */
export type CriterionParts = Record<string, string[]>;

/** "LU1" + "Doceren" → "lu1_doceren": option names that describe the option (TypeSafe). */
function outcomeSlugs(d: DossierData): string[] {
  const seen = new Set<string>();
  return d.framework.outcomes.map((o, i) => {
    const base =
      [o.code, o.title]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 40) || `outcome_${i + 1}`;
    const slug = seen.has(base) ? `${base}_${i + 1}` : base;
    seen.add(slug);
    return slug;
  });
}

const partKey = (slug: string, j: number, k: number) => `c_${slug}_${j + 1}_${k + 1}`;
const requiredKey = (slug: string, j: number) => `r_${slug}_${j + 1}`;

/** "Mijn bewijs/LU1/lesplan.docx" → "Mijn bewijs/LU1"; no folder → "". */
function folderOf(name: string): string {
  return name.split(/[\\/]/).slice(0, -1).join("/").slice(0, BATCH_LIMITS.name);
}

function rotated<T>(xs: readonly T[], n: number): T[] {
  if (xs.length === 0) return [];
  const k = ((n % xs.length) + xs.length) % xs.length;
  return [...xs.slice(k), ...xs.slice(0, k)];
}

/**
 * One request for one file: every question about it shares the file as state. `rotate` turns
 * the order of the outcome and kind options (TypeSafe: Jev leans toward the first option).
 */
export function buildJevRequest(
  d: DossierData,
  file: { name: string; text: string },
  locale: Locale,
  opts: { model: string; parts?: CriterionParts; rotate?: number },
): JevRequest {
  const t = JEV_TEXT[locale];
  const outcomes = d.framework.outcomes;
  const slugs = outcomeSlugs(d);
  const text = file.text.trim();
  const rotate = opts.rotate ?? 0;
  const outcomeOptions = rotated(
    outcomes.map((o, i) => [
      slugs[i] as string,
      {
        [t.outcomeLabel]: [o.code, o.title].filter(Boolean).join(" "),
        [t.criteriaLabel]: o.criteria.map((c) => c.text),
      },
    ]),
    rotate,
  );
  const kindOptions = rotated(
    EVIDENCE_KINDS.map((k) => [k, t.kinds[k]]),
    rotate,
  );
  const questions: Record<string, JevQuestion> = {
    evidence: {
      type: "noul",
      instructions: t.evidence,
      criteria: { true: t.evidenceYes, false: t.evidenceNo },
    },
    outcome: {
      type: "choice",
      instructions: t.outcome,
      criteria: Object.fromEntries(outcomeOptions),
    },
    kind: { type: "choice", instructions: t.kind, criteria: Object.fromEntries(kindOptions) },
  };
  outcomes.forEach((o, i) => {
    const slug = slugs[i] as string;
    o.criteria.forEach((c, j) => {
      const parts = opts.parts?.[c.text] ?? [c.text];
      parts.forEach((part, k) => {
        questions[partKey(slug, j, k)] = {
          type: "noul",
          instructions: t.criterion(part),
          criteria: { true: t.criterionYes, false: t.criterionNo },
        };
      });
    });
    o.requiredEvidence.forEach((r, j) => {
      questions[requiredKey(slug, j)] = {
        type: "noul",
        instructions: t.required(r),
        criteria: { true: t.requiredYes, false: t.requiredNo },
      };
    });
  });
  return {
    model: opts.model,
    state: {
      dossier: t.dossier,
      file: {
        folder: folderOf(file.name),
        name: file.name.split(/[\\/]/).pop()?.slice(0, BATCH_LIMITS.name) ?? "",
        text: text.slice(0, BATCH_LIMITS.excerpt),
      },
      about_text: text ? t.aboutText : t.noText,
    },
    questions,
  };
}

// ── The answer ──────────────────────────────────────────────────────────────

const Answer = z.object({
  type: z.string(),
  choice: z.string().optional(),
  noul: z.number().optional(),
  probabilities: z.record(z.string(), z.number()).optional(),
});
type Answer = z.infer<typeof Answer>;
const Response = z.object({
  answers: z.record(z.string(), Answer),
  usage: z.object({ cost: z.number().optional() }).partial().optional(),
});

export interface JevParsed {
  proposal: SortProposal;
  /** The body had answers at all (the scorer's `parse` check). */
  usable: boolean;
  outcomeProbability?: number;
  costUsd?: number;
  /**
   * Why the row says "Controleren": `unusable`, `not-evidence`, `evidence` (unsettled whether
   * it is evidence), `none` (no outcome chosen), `outcome` or `kind` (below its threshold or
   * unknown), `unsettled:<question>` (only with `unsettled` on), `no-criteria`, `no-text`.
   */
  why: string[];
}

/** The probability of the option Jev chose, or `undefined` when it chose none or refused. */
function picked(a: Answer | undefined): { choice: string; p: number } | undefined {
  if (a?.type !== "choice" || a.choice === undefined) return undefined;
  return { choice: a.choice, p: a.probabilities?.[a.choice] ?? 0 };
}

const yesOf = (a: Answer | undefined) =>
  a?.type === "noul" && a.noul !== undefined ? a.noul : undefined;

const isKind = (k: string): k is EvidenceKind => (EVIDENCE_KINDS as readonly string[]).includes(k);

/**
 * The truth table: Jev's judgments → the app's proposal for one file.
 *
 * | "is this evidence?" | → |
 * | --- | --- |
 * | no (≤ no) | no outcome, no criteria, check |
 * | unsettled | the outcome stays, check |
 * | yes (≥ yes) | the outcome stays |
 *
 * Then: the top outcome and kind, a check when either is below its threshold; a criterion is
 * proposed when one of its parts is a yes (evidence of part of it is evidence for it), an
 * unsettled or no part proposes nothing; the required line is the best yes; a check when no
 * criterion is proposed or there is no text.
 */
export function parseJevAnswer(
  body: unknown,
  d: DossierData,
  file: { key: string; name: string; text?: string },
  t: JevThresholds = JEV_THRESHOLDS,
): JevParsed {
  const fallback: SortProposal = {
    key: file.key,
    title: baseName(file.name),
    kind: "other",
    criterionIds: [],
    check: true,
  };
  const parsed = Response.safeParse(body);
  if (!parsed.success) return { proposal: fallback, usable: false, why: ["unusable"] };
  const { answers, usage } = parsed.data;
  const costUsd = usage?.cost;
  const slugs = outcomeSlugs(d);

  const evidenceP = yesOf(answers.evidence);
  const notEvidence = evidenceP !== undefined && evidenceP <= t.no;
  const outcomeAnswer = picked(answers.outcome);
  const index = notEvidence ? -1 : slugs.indexOf(outcomeAnswer?.choice ?? "");
  const outcome = d.framework.outcomes[index];
  const slug = slugs[index];
  const kindAnswer = picked(answers.kind);
  const kind = kindAnswer && isKind(kindAnswer.choice) ? kindAnswer.choice : "other";

  const isUnsettled = (p: number | undefined) => p === undefined || (p > t.no && p < t.yes);
  const unsettled: string[] = [];
  const criterionIds: string[] = [];
  let line: string | undefined;
  if (outcome && slug) {
    outcome.criteria.forEach((c, j) => {
      const prefix = `c_${slug}_${j + 1}_`;
      const parts = Object.entries(answers).filter(([k]) => k.startsWith(prefix));
      const ps = parts.map(([, a]) => yesOf(a));
      if (ps.some((p) => p !== undefined && p >= t.yes)) criterionIds.push(c.id);
      else if (ps.length === 0 || ps.some(isUnsettled)) unsettled.push(`${prefix.slice(0, -1)}`);
    });
    let best: number = t.yes;
    outcome.requiredEvidence.forEach((r, j) => {
      const p = yesOf(answers[requiredKey(slug, j)]);
      if (isUnsettled(p)) unsettled.push(requiredKey(slug, j));
      if (p !== undefined && p >= best) {
        best = p;
        line = r;
      }
    });
  }

  const why = [
    ...(notEvidence
      ? ["not-evidence"]
      : evidenceP === undefined || evidenceP < t.yes
        ? ["evidence"]
        : []),
    ...(notEvidence
      ? []
      : !outcome
        ? ["none"]
        : (outcomeAnswer?.p ?? 0) < t.outcomeSure
          ? ["outcome"]
          : []),
    ...(!notEvidence && (!kindAnswer || !isKind(kindAnswer.choice) || kindAnswer.p < t.kindSure)
      ? ["kind"]
      : []),
    ...(t.unsettled ? unsettled.map((k) => `unsettled:${k}`) : []),
    ...(outcome && criterionIds.length === 0 ? ["no-criteria"] : []),
    ...(file.text !== undefined && file.text.trim() === "" ? ["no-text"] : []),
  ];

  return {
    proposal: {
      key: file.key,
      title: fallback.title,
      kind,
      ...(outcome ? { outcomeId: outcome.id } : {}),
      criterionIds,
      ...(line ? { line } : {}),
      check: why.length > 0,
    },
    usable: true,
    why,
    ...(outcomeAnswer ? { outcomeProbability: outcomeAnswer.p } : {}),
    ...(costUsd !== undefined ? { costUsd } : {}),
  };
}
