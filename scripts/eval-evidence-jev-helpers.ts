/**
 * An experiment (2026-11-13): the evidence sort of "Bewijs in één keer" as typed decisions for
 * TypeSafe's Jev, through OpenRouter's Decisions API, next to the LLM that does it now.
 *
 * Built to TypeSafe's own skill (plugin `typesafe@typesafe-ai`, enabled in `.claude/settings.json`;
 * followed at commit 302eea6 of github.com/typesafe-ai/skills) and docs, in full:
 * - judgments from Jev, the decision in code (the truth table in `parseJevAnswer`);
 * - state as named fields, with the facts code knows (what the dossier is, what the text is);
 * - one judgment per question: a compound criterion is asked per part
 *   (`evals/portfolio-evidence/jev-criterion-parts.json`; in the app that split would be made
 *   once per framework), and code combines the parts;
 * - the null case as a companion yes/no ("is this evidence?"), not a "none" option;
 * - descriptive option names, option descriptions that say what they cover and exclude,
 *   questions that name the state by its path;
 * - thresholds 0.7 / 0.3 as TypeSafe's starting points, the band between with its own row;
 * - the option order rotated per repeat, against Jev's lean toward the first option;
 * - the exact request kept with each answer, so any result can be rerun.
 *
 * Jev writes no text: the title is the file's own name and there is no reason line. The answer
 * becomes the app's own `SortProposal`, so the existing scorer judges both the same way. Eval
 * only: nothing in the app calls Jev.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { BATCH_LIMITS, baseName, type SortProposal } from "../app/lib/portfolio/batch";
import { type DossierData, EVIDENCE_KINDS, type EvidenceKind } from "../app/lib/portfolio/types";

/** Pinned, so two measurements compare the same model. */
export const JEV_MODEL = "typesafe/jev-1.14";

const JEV_URL = "https://openrouter.ai/api/alpha/decisions";

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

type Locale = "nl" | "en";
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

/** The split of the eval frameworks' compound criteria, made once from their text alone. */
export function loadCriterionParts(): CriterionParts {
  const file = join(__dirname, "../evals/portfolio-evidence/jev-criterion-parts.json");
  return (JSON.parse(readFileSync(file, "utf8")) as { parts: CriterionParts }).parts;
}

const TEXT = {
  nl: {
    dossier:
      "Een BDB/BKE-dossier van een docent in het hoger onderwijs: per leeruitkomst verzamelt de docent eigen werk als bewijs.",
    aboutText:
      "`file.text` is het begin van het bestand; namen van studenten zijn vervangen door codes zoals [STUDENT-1].",
    noText: "Er is geen tekst uit dit bestand gelezen: `file.text` is leeg, alleen `file.name` is bekend.",
    evidence: "Laat `file` werk zien van de docent zelf, als bewijs voor het dossier?",
    evidenceYes:
      "Het laat werk van de docent zien, zoals een lesplan, toets, verslag van een eigen les of gesprek, feedback op de docent, een analyse, reflectie of ontwikkelplan.",
    evidenceNo:
      "Een leeg sjabloon of format, algemene informatie, notulen of organisatie, of iets zonder verband met het werk van de docent.",
    outcome:
      "Bij welke leeruitkomst van het dossier hoort `file` als bewijs? `file.folder` is een aanwijzing; de inhoud van `file.text` weegt zwaarder.",
    kind: "Wat voor soort stuk is `file`?",
    outcomeLabel: "leeruitkomst",
    criteriaLabel: "criteria",
    criterion: (c: string) => `Laat \`file.text\` zien dat de docent dit doet: ${c}`,
    criterionYes: "Het bestand laat concreet zien dat de docent dit zelf doet of deed.",
    criterionNo: "Het bestand gaat over iets anders, of noemt dit alleen zonder dat de docent het laat zien.",
    required: (r: string) => `Is \`file\` dit stuk verplicht bewijs: ${r}`,
    requiredYes: "Het bestand is dit stuk, of een versie ervan.",
    requiredNo: "Het bestand is een ander soort stuk.",
    kinds: {
      "lesson-plan": { omvat: "Een lesvoorbereiding of lesplan van de docent.", niet: "Een leeg werkblad of format." },
      "observation-notes": {
        omvat: "Een opname, transcript, observatie of verslag van een eigen les of begeleidingsgesprek.",
        niet: "Notulen van een vergadering.",
      },
      feedback: {
        omvat: "Feedback van een ander op de docent: een werkplekbegeleider, collega, leidinggevende of studenten.",
        niet: "Een eigen reflectie van de docent, of de uitvoer van een AI-tool.",
      },
      "test-material": { omvat: "Een toets, toetsmatrijs, antwoordmodel of rubric.", niet: "Een analyse van toetsresultaten." },
      analysis: {
        omvat: "Een analyse, zoals een toetsanalyse of een evaluatie met conclusies.",
        niet: "Een eigen reflectie op een les.",
      },
      other: {
        omvat: "Iets anders: een eigen reflectie, een ontwikkelplan, uitvoer van een AI-tool, notulen of een leeg sjabloon.",
      },
    },
  },
  en: {
    dossier:
      "A teaching-qualification dossier of a teacher in higher education: per learning outcome the teacher collects their own work as evidence.",
    aboutText: "`file.text` is the start of the file; student names are replaced by codes such as [STUDENT-1].",
    noText: "No text was read from this file: `file.text` is empty, only `file.name` is known.",
    evidence: "Does `file` show the teacher's own work, as evidence for the dossier?",
    evidenceYes:
      "It shows the teacher's work, such as a lesson plan, test, report of their own lesson or conversation, feedback on the teacher, an analysis, reflection or development plan.",
    evidenceNo:
      "An empty template or format, general information, meeting minutes or logistics, or something unrelated to the teacher's work.",
    outcome:
      "Which learning outcome of the dossier does `file` belong to as evidence? `file.folder` is a hint; the content of `file.text` weighs more.",
    kind: "What kind of document is `file`?",
    outcomeLabel: "learning_outcome",
    criteriaLabel: "criteria",
    criterion: (c: string) => `Does \`file.text\` show the teacher doing this: ${c}`,
    criterionYes: "The file concretely shows the teacher doing or having done this themselves.",
    criterionNo: "The file is about something else, or only mentions this without showing the teacher doing it.",
    required: (r: string) => `Is \`file\` this piece of required evidence: ${r}`,
    requiredYes: "The file is this piece, or a version of it.",
    requiredNo: "The file is another kind of document.",
    kinds: {
      "lesson-plan": { covers: "A lesson preparation or lesson plan by the teacher.", excludes: "An empty worksheet or format." },
      "observation-notes": {
        covers: "A recording, transcript, observation or report of the teacher's own lesson or coaching conversation.",
        excludes: "Minutes of a meeting.",
      },
      feedback: {
        covers: "Feedback from someone else on the teacher: a workplace supervisor, colleague, manager or students.",
        excludes: "The teacher's own reflection, or the output of an AI tool.",
      },
      "test-material": { covers: "A test, test blueprint, answer key or rubric.", excludes: "An analysis of test results." },
      analysis: {
        covers: "An analysis, such as a test analysis or an evaluation with conclusions.",
        excludes: "The teacher's own reflection on a lesson.",
      },
      other: {
        covers: "Something else: the teacher's own reflection, a development plan, AI tool output, meeting minutes or an empty template.",
      },
    },
  },
} satisfies Record<Locale, { kinds: Record<EvidenceKind, Record<string, string>> } & Record<string, unknown>>;

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
  opts: { model?: string; parts?: CriterionParts; rotate?: number } = {},
): JevRequest {
  const t = TEXT[locale];
  const outcomes = d.framework.outcomes;
  const slugs = outcomeSlugs(d);
  const text = file.text.trim();
  const rotate = opts.rotate ?? 0;
  const outcomeOptions = rotated(
    outcomes.map((o, i) => [
      slugs[i] as string,
      { [t.outcomeLabel]: [o.code, o.title].filter(Boolean).join(" "), [t.criteriaLabel]: o.criteria.map((c) => c.text) },
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
    outcome: { type: "choice", instructions: t.outcome, criteria: Object.fromEntries(outcomeOptions) },
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
    model: opts.model ?? JEV_MODEL,
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

const yesOf = (a: Answer | undefined) => (a?.type === "noul" && a.noul !== undefined ? a.noul : undefined);

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
    ...(notEvidence ? [] : !outcome ? ["none"] : (outcomeAnswer?.p ?? 0) < t.outcomeSure ? ["outcome"] : []),
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

// ── The call ────────────────────────────────────────────────────────────────

/** Any Decisions API request: a model, the state, and named questions. */
interface JevPayload {
  model: string;
  state: unknown;
  questions: Record<string, unknown>;
}

/** One POST to OpenRouter's Decisions API (alpha). Throws on an error status. */
export async function askJev(
  req: JevPayload,
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
