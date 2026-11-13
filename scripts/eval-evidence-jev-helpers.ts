/**
 * An experiment (2026-11-13): the evidence sort of "Bewijs in één keer" as typed decisions for
 * TypeSafe's Jev, through OpenRouter's Decisions API, next to the LLM that does it now. Jev
 * answers choices and yes/no questions with calibrated probabilities and writes no text, so:
 *
 * - "is this evidence at all?" is its own `noul`, as TypeSafe advises next to a choice;
 * - the outcome (over the outcomes only) and the kind are a `choice`;
 * - every criterion and every line of the required evidence is a `noul` (yes/no), where part of a
 *   compound criterion counts ("asks for feedback and uses it");
 * - "Controleren" comes from the probabilities, not from a `sure` the model gives itself;
 * - the title is the file's own name, and there is no reason line.
 *
 * The answer becomes the app's own `SortProposal`, so the existing scorer judges both the same
 * way. Eval only: nothing in the app calls Jev.
 */
import { z } from "zod";
import { BATCH_LIMITS, baseName, type SortProposal } from "../app/lib/portfolio/batch";
import { type DossierData, EVIDENCE_KINDS, type EvidenceKind } from "../app/lib/portfolio/types";

/** Pinned, so two measurements compare the same model. */
export const JEV_MODEL = "typesafe/jev-1.14";

const JEV_URL = "https://openrouter.ai/api/alpha/decisions";

/**
 * Starting points from TypeSafe's own skill (yes ≥ 0.7, no ≤ 0.3, in between is unsettled);
 * the outcome and kind must be clearer before a row goes without "Controleren". Tuned on the
 * saved answers of meting jev3 (`evals/portfolio-evidence/rubric.md`).
 */
export const JEV_THRESHOLDS: JevThresholds = {
  outcomeSure: 0.8,
  kindSure: 0.7,
  yes: 0.7,
  no: 0.3,
  // Off since meting jev3 (2026-11-13): BDB criteria are compound ("asks for feedback and uses
  // it"), so Jev often lands mid-way on one; flagging that put 55 of 69 rows on "Controleren".
  unsettled: false,
};

export interface JevThresholds {
  outcomeSure: number;
  kindSure: number;
  /** A yes/no counts as yes from here, … */
  yes: number;
  /** … as no up to here; in between it is unsettled. */
  no: number;
  /** Does an unsettled yes/no of the chosen outcome set "Controleren"? */
  unsettled: boolean;
}

type Locale = "nl" | "en";

interface JevQuestion {
  type: "choice" | "noul";
  instructions: string;
  criteria?: Record<string, string>;
}

export interface JevRequest {
  model: string;
  /** Named fields, as TypeSafe advises: the folder the teacher chose, the file, its text. */
  state: { folder: string; file: string; text: string };
  questions: Record<string, JevQuestion>;
}

const TEXT = {
  nl: {
    noText: "(Er is geen tekst gelezen uit dit bestand; ga alleen uit van de naam.)",
    evidence:
      "Is dit bestand bewijs van het werk van de docent zelf, voor een BDB/BKE-dossier?",
    evidenceYes:
      "Ja: het laat werk van de docent zien, zoals een lesplan, toets, verslag van een eigen les of gesprek, feedback op de docent, een analyse, reflectie of ontwikkelplan.",
    evidenceNo:
      "Nee: een leeg sjabloon of format, algemene informatie, notulen of organisatie, of iets zonder verband met het werk van de docent.",
    outcome:
      "Bij welke leeruitkomst van het BDB/BKE-dossier van de docent past dit bestand het best? De map is een aanwijzing, maar de inhoud weegt zwaarder.",
    criteria: "Criteria",
    kind: "Wat voor soort bewijs is dit bestand?",
    criterion: (c: string) => `Laat dit bestand zien dat de docent dit doet: "${c}"?`,
    criterionYes:
      "Ja: het bestand laat zien dat de docent dit doet of deed, ook als het maar een deel van het criterium is.",
    criterionNo: "Nee: het bestand gaat er niet over, of noemt het alleen zonder het te laten zien.",
    required: (r: string) => `Is dit bestand dit stuk verplicht bewijs: "${r}"?`,
    requiredYes: "Ja: het bestand is dit stuk, of een versie ervan.",
    requiredNo: "Nee: het is een ander soort stuk.",
    kinds: {
      "lesson-plan": "Een lesvoorbereiding of lesplan van de docent.",
      "observation-notes":
        "Een opname, transcript, observatie of verslag van een eigen les of begeleidingsgesprek. Geen notulen van een vergadering.",
      feedback:
        "Feedback van een ander op de docent: een werkplekbegeleider, collega, leidinggevende of studenten. Een eigen reflectie of de uitvoer van een AI-tool is nooit feedback.",
      "test-material": "Een toets, toetsmatrijs, antwoordmodel of rubric.",
      analysis: "Een analyse, zoals een toetsanalyse of een evaluatie met conclusies.",
      other:
        "Iets anders: een eigen reflectie, een ontwikkelplan, uitvoer van een AI-tool, notulen of een leeg sjabloon.",
    },
  },
  en: {
    noText: "(No text could be read from this file; go by its name only.)",
    evidence: "Is this file evidence of the teacher's own work, for a teaching-qualification dossier?",
    evidenceYes:
      "Yes: it shows the teacher's work, such as a lesson plan, test, report of their own lesson or conversation, feedback on the teacher, an analysis, reflection or development plan.",
    evidenceNo:
      "No: an empty template or format, general information, meeting minutes or logistics, or something unrelated to the teacher's work.",
    outcome:
      "Which learning outcome of the teacher's teaching-qualification dossier does this file fit best? The folder is a hint, but the content weighs more.",
    criteria: "Criteria",
    kind: "What kind of evidence is this file?",
    criterion: (c: string) => `Does this file show the teacher doing this: "${c}"?`,
    criterionYes:
      "Yes: the file shows the teacher doing or having done this, even if only part of the criterion.",
    criterionNo: "No: the file is not about it, or only mentions it without showing it.",
    required: (r: string) => `Is this file this piece of required evidence: "${r}"?`,
    requiredYes: "Yes: the file is this piece, or a version of it.",
    requiredNo: "No: it is another kind of document.",
    kinds: {
      "lesson-plan": "A lesson preparation or lesson plan by the teacher.",
      "observation-notes":
        "A recording, transcript, observation or report of the teacher's own lesson or coaching conversation. Not minutes of a meeting.",
      feedback:
        "Feedback from someone else on the teacher: a workplace supervisor, colleague, manager or students. The teacher's own reflection or the output of an AI tool is never feedback.",
      "test-material": "A test, test blueprint, answer key or rubric.",
      analysis: "An analysis, such as a test analysis or an evaluation with conclusions.",
      other:
        "Something else: the teacher's own reflection, a development plan, AI tool output, meeting minutes or an empty template.",
    },
  },
} satisfies Record<Locale, { kinds: Record<EvidenceKind, string> } & Record<string, unknown>>;

const outcomeKey = (i: number) => `U${i + 1}`;
const criterionKey = (i: number, j: number) => `c_${outcomeKey(i)}_${j + 1}`;
const requiredKey = (i: number, j: number) => `r_${outcomeKey(i)}_${j + 1}`;

/** "Mijn bewijs/LU1/lesplan.docx" → "Mijn bewijs/LU1"; no folder → "". */
function folderOf(name: string): string {
  const parts = name.split(/[\\/]/);
  return parts.slice(0, -1).join("/").slice(0, BATCH_LIMITS.name);
}

/** One request for one file: every question about it shares the file as state. */
export function buildJevRequest(
  d: DossierData,
  file: { name: string; text: string },
  locale: Locale,
  model = JEV_MODEL,
): JevRequest {
  const t = TEXT[locale];
  const outcomes = d.framework.outcomes;
  const text = file.text.trim();
  const questions: Record<string, JevQuestion> = {
    evidence: {
      type: "noul",
      instructions: t.evidence,
      criteria: { true: t.evidenceYes, false: t.evidenceNo },
    },
    outcome: {
      type: "choice",
      instructions: t.outcome,
      criteria: Object.fromEntries(
        outcomes.map((o, i) => [
          outcomeKey(i),
          [[o.code, o.title].filter(Boolean).join(" "), `${t.criteria}: ${o.criteria.map((c) => c.text).join("; ")}`].join(". "),
        ]),
      ),
    },
    kind: { type: "choice", instructions: t.kind, criteria: { ...t.kinds } },
  };
  outcomes.forEach((o, i) => {
    o.criteria.forEach((c, j) => {
      questions[criterionKey(i, j)] = {
        type: "noul",
        instructions: t.criterion(c.text),
        criteria: { true: t.criterionYes, false: t.criterionNo },
      };
    });
    o.requiredEvidence.forEach((r, j) => {
      questions[requiredKey(i, j)] = {
        type: "noul",
        instructions: t.required(r),
        criteria: { true: t.requiredYes, false: t.requiredNo },
      };
    });
  });
  return {
    model,
    state: {
      folder: folderOf(file.name),
      file: file.name.split(/[\\/]/).pop()?.slice(0, BATCH_LIMITS.name) ?? "",
      text: text ? text.slice(0, BATCH_LIMITS.excerpt) : t.noText,
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
   * Why the row says "Controleren": `unusable`, `not-evidence` or `evidence` (unsure whether it
   * is evidence), `none` (no outcome), `outcome` or `kind` (below
   * its threshold or unknown), `unsettled:<question>`, `no-criteria`, `no-text`. Empty = sure.
   */
  why: string[];
}

/** The probability of the option Jev chose, or `undefined` when it chose none or refused. */
function picked(a: z.infer<typeof Answer> | undefined): { choice: string; p: number } | undefined {
  if (a?.type !== "choice" || a.choice === undefined) return undefined;
  return { choice: a.choice, p: a.probabilities?.[a.choice] ?? 0 };
}

const yesOf = (a: z.infer<typeof Answer> | undefined) =>
  a?.type === "noul" && a.noul !== undefined ? a.noul : undefined;

const isKind = (k: string): k is EvidenceKind => (EVIDENCE_KINDS as readonly string[]).includes(k);

/**
 * Jev's answers as the app's proposal for one file. Only criteria and lines of the chosen
 * outcome count; anything Jev was unsure of, refused, or that is unknown, is "Controleren".
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

  const evidenceP = yesOf(answers.evidence);
  const notEvidence = evidenceP !== undefined && evidenceP <= t.no;
  const outcomeAnswer = picked(answers.outcome);
  const index = notEvidence
    ? -1
    : d.framework.outcomes.findIndex((_, i) => outcomeKey(i) === outcomeAnswer?.choice);
  const outcome = d.framework.outcomes[index];
  const kindAnswer = picked(answers.kind);
  const kind = kindAnswer && isKind(kindAnswer.choice) ? kindAnswer.choice : "other";

  const unsettled: string[] = [];
  const isUnsettled = (p: number | undefined) =>
    p === undefined || (p > t.no && p < t.yes);
  const criterionIds: string[] = [];
  let line: string | undefined;
  if (outcome) {
    outcome.criteria.forEach((c, j) => {
      const p = yesOf(answers[criterionKey(index, j)]);
      if (isUnsettled(p)) unsettled.push(criterionKey(index, j));
      if (p !== undefined && p >= t.yes) criterionIds.push(c.id);
    });
    let best: number = t.yes;
    outcome.requiredEvidence.forEach((r, j) => {
      const p = yesOf(answers[requiredKey(index, j)]);
      if (isUnsettled(p)) unsettled.push(requiredKey(index, j));
      if (p !== undefined && p >= best) {
        best = p;
        line = r;
      }
    });
  }

  const why = [
    ...(notEvidence ? ["not-evidence"] : evidenceP === undefined || evidenceP < t.yes ? ["evidence"] : []),
    ...(notEvidence ? [] : !outcome ? ["none"] : (outcomeAnswer?.p ?? 0) < t.outcomeSure ? ["outcome"] : []),
    ...(!notEvidence && (!kindAnswer || !isKind(kindAnswer.choice) || kindAnswer.p < t.kindSure)
      ? ["kind"]
      : []),
    ...(t.unsettled ? unsettled.map((k) => `unsettled:${k}`) : []),
    ...(outcome && criterionIds.length === 0 ? ["no-criteria"] : []),
    ...(file.text !== undefined && file.text.trim() === "" ? ["no-text"] : []),
  ];
  const check = why.length > 0;

  return {
    proposal: {
      key: file.key,
      title: fallback.title,
      kind,
      ...(outcome ? { outcomeId: outcome.id } : {}),
      criterionIds,
      ...(line ? { line } : {}),
      check,
    },
    usable: true,
    why,
    ...(outcomeAnswer ? { outcomeProbability: outcomeAnswer.p } : {}),
    ...(costUsd !== undefined ? { costUsd } : {}),
  };
}

// ── The call ────────────────────────────────────────────────────────────────

/** One POST to OpenRouter's Decisions API (alpha). Throws on an error status. */
export async function askJev(
  req: JevRequest,
  opts: { apiKey: string; fetch?: typeof fetch },
): Promise<{ body: unknown; ms: number }> {
  const start = performance.now();
  const res = await (opts.fetch ?? fetch)(JEV_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${opts.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  const ms = Math.round(performance.now() - start);
  if (!res.ok) throw new Error(`Jev via OpenRouter: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return { body: (await res.json()) as unknown, ms };
}
