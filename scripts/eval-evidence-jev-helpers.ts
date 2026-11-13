/**
 * An experiment (2026-11-13): the evidence sort of "Bewijs in één keer" as typed decisions for
 * TypeSafe's Jev, through OpenRouter's Decisions API, next to the LLM that does it now. Jev
 * answers choices and yes/no questions with calibrated probabilities and writes no text, so:
 *
 * - the outcome and the kind are a `choice` (with "none" for the outcome);
 * - every criterion and every line of the required evidence is a `noul` (yes/no);
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
 * the outcome and kind must be clearer before a row goes without "Controleren".
 */
export const JEV_THRESHOLDS = { outcomeSure: 0.8, kindSure: 0.7, yes: 0.7, no: 0.3 } as const;

type Locale = "nl" | "en";

interface JevQuestion {
  type: "choice" | "noul";
  instructions: string;
  criteria?: Record<string, string>;
}

export interface JevRequest {
  model: string;
  state: { file: string; text: string };
  questions: Record<string, JevQuestion>;
}

const TEXT = {
  nl: {
    noText: "(Er is geen tekst gelezen uit dit bestand; ga alleen uit van de naam.)",
    outcome:
      "Bij welke leeruitkomst van het BDB/BKE-dossier van de docent hoort dit bestand als bewijs? Een mapnaam zoals LU1 is een aanwijzing, maar de inhoud weegt zwaarder.",
    none: "Het bestand hoort duidelijk bij geen enkele leeruitkomst, of het is geen bewijs (zoals een leeg sjabloon).",
    criteria: "Criteria",
    kind: "Wat voor soort bewijs is dit bestand?",
    criterion: (c: string) => `Laat dit bestand zichtbaar zien dat de docent dit criterium uitvoert: "${c}"?`,
    required: (r: string) => `Vult dit bestand deze regel van het verplicht bewijs in: "${r}"?`,
    kinds: {
      "lesson-plan": "Een lesvoorbereiding of lesplan.",
      "observation-notes": "Een opname, observatie of verslag van een les of gesprek.",
      feedback:
        "Feedback van een ander: een werkplekbegeleider, collega, leidinggevende of studenten. Een eigen reflectie of de uitvoer van een AI-tool is nooit feedback.",
      "test-material": "Een toets, toetsmatrijs, antwoordmodel of rubric.",
      analysis: "Een analyse, zoals een toetsanalyse of een evaluatie.",
      other: "Iets anders, zoals een eigen reflectie.",
    },
  },
  en: {
    noText: "(No text could be read from this file; go by its name only.)",
    outcome:
      "Which learning outcome of the teacher's teaching-qualification dossier does this file belong to as evidence? A folder name such as LO1 is a hint, but the content weighs more.",
    none: "The file clearly belongs to no learning outcome, or it is not evidence (such as an empty template).",
    criteria: "Criteria",
    kind: "What kind of evidence is this file?",
    criterion: (c: string) => `Does this file visibly show the teacher meeting this criterion: "${c}"?`,
    required: (r: string) => `Does this file fill this line of the required evidence: "${r}"?`,
    kinds: {
      "lesson-plan": "A lesson preparation or lesson plan.",
      "observation-notes": "A recording, observation or report of a lesson or conversation.",
      feedback:
        "Feedback from someone else: a workplace supervisor, colleague, manager or students. The teacher's own reflection or the output of an AI tool is never feedback.",
      "test-material": "A test, test blueprint, answer key or rubric.",
      analysis: "An analysis, such as a test analysis or an evaluation.",
      other: "Something else, such as the teacher's own reflection.",
    },
  },
} satisfies Record<Locale, { kinds: Record<EvidenceKind, string> } & Record<string, unknown>>;

const outcomeKey = (i: number) => `U${i + 1}`;
const criterionKey = (i: number, j: number) => `c_${outcomeKey(i)}_${j + 1}`;
const requiredKey = (i: number, j: number) => `r_${outcomeKey(i)}_${j + 1}`;

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
    outcome: {
      type: "choice",
      instructions: t.outcome,
      criteria: {
        ...Object.fromEntries(
          outcomes.map((o, i) => [
            outcomeKey(i),
            [[o.code, o.title].filter(Boolean).join(" "), `${t.criteria}: ${o.criteria.map((c) => c.text).join("; ")}`].join(". "),
          ]),
        ),
        none: t.none,
      },
    },
    kind: { type: "choice", instructions: t.kind, criteria: { ...t.kinds } },
  };
  outcomes.forEach((o, i) => {
    o.criteria.forEach((c, j) => {
      questions[criterionKey(i, j)] = { type: "noul", instructions: t.criterion(c.text) };
    });
    o.requiredEvidence.forEach((r, j) => {
      questions[requiredKey(i, j)] = { type: "noul", instructions: t.required(r) };
    });
  });
  return {
    model,
    state: {
      file: file.name.slice(0, BATCH_LIMITS.name),
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
   * Why the row says "Controleren": `unusable`, `none` (no outcome), `outcome` or `kind` (below
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

  const outcomeAnswer = picked(answers.outcome);
  const index = d.framework.outcomes.findIndex((_, i) => outcomeKey(i) === outcomeAnswer?.choice);
  const outcome = d.framework.outcomes[index];
  const kindAnswer = picked(answers.kind);
  const kind = kindAnswer && isKind(kindAnswer.choice) ? kindAnswer.choice : "other";

  const unsettled: string[] = [];
  const isUnsettled = (p: number | undefined) =>
    p === undefined || (p > JEV_THRESHOLDS.no && p < JEV_THRESHOLDS.yes);
  const criterionIds: string[] = [];
  let line: string | undefined;
  if (outcome) {
    outcome.criteria.forEach((c, j) => {
      const p = yesOf(answers[criterionKey(index, j)]);
      if (isUnsettled(p)) unsettled.push(criterionKey(index, j));
      if (p !== undefined && p >= JEV_THRESHOLDS.yes) criterionIds.push(c.id);
    });
    let best: number = JEV_THRESHOLDS.yes;
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
    ...(!outcome ? ["none"] : (outcomeAnswer?.p ?? 0) < JEV_THRESHOLDS.outcomeSure ? ["outcome"] : []),
    ...(!kindAnswer || !isKind(kindAnswer.choice) || kindAnswer.p < JEV_THRESHOLDS.kindSure
      ? ["kind"]
      : []),
    ...unsettled.map((k) => `unsettled:${k}`),
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
