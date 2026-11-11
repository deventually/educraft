/**
 * Pure helpers for the guided-writing eval (`npm run eval:guided`): build a dossier from a
 * synthetic case, and score the questions and the paragraph deterministically (no judge model).
 */
import { markersIn, splitOnMarkers } from "../app/lib/portfolio/openSpots";
import { emptyDossier } from "../app/lib/portfolio/schema";
import { DRAFT_PROMPT_ID, QUESTIONS_PROMPT_ID } from "../app/lib/portfolio/guided";
import type { DossierData, EvidenceKind } from "../app/lib/portfolio/types";

export interface GuidedCase {
  id: string;
  description?: string;
  locale: "nl" | "en";
  /** With a title: a section of the form's outline. Without: the form gives none (one criterion). */
  section: { title?: string; description?: string };
  criteria: { text: string; strongLevel?: string }[];
  /** Linked to every criterion of the case. */
  evidence: { title: string; kind: EvidenceKind; text: string }[];
  chapter?: string;
  references?: string[];
  /** The teacher's answers the paragraph is written from (the questions are fixed by the case). */
  answers: { question: string; answer: string }[];
  expect: {
    /** Patterns (case-insensitive); each must match at least one question. */
    askAbout: string[];
    /** Text that must appear in no question and not in the paragraph (e.g. an injected word). */
    forbidden: string[];
    /** Fragments from the answers or evidence the paragraph must keep. */
    facts: string[];
    /** The material leaves a gap: the paragraph must hold an open spot. */
    gap: boolean;
    /** A known-good answer for each step, for the scorer's own test. */
    goodQuestions: string[];
    goodParagraph: string;
  };
}

const OUTCOME = "eval-outcome";
const SECTION = "eval-section";

/** The dossier the app would hold for this case: confirmed, in draft mode, answers saved. */
export function caseDossier(c: GuidedCase): {
  data: DossierData;
  outcomeId: string;
  sectionId: string;
} {
  const criterionIds = c.criteria.map((_, i) => `eval-c${i + 1}`);
  const outlined = Boolean(c.section.title);
  const sectionId = outlined ? SECTION : (criterionIds[0] ?? "");
  const d = emptyDossier(["bdb"]);
  const data: DossierData = {
    ...d,
    coachMode: "draft",
    framework: {
      institution: "Hogeschool (eval)",
      requirements: {},
      confirmedAt: 1,
      outcomes: [
        {
          id: OUTCOME,
          code: "LU1",
          title: "Eval",
          criteria: c.criteria.map((x, i) => ({ id: criterionIds[i] ?? "", ...x })),
          requiredEvidence: [],
          ...(outlined
            ? {
                outline: [
                  {
                    id: SECTION,
                    title: c.section.title ?? "",
                    ...(c.section.description ? { description: c.section.description } : {}),
                    criterionIds,
                  },
                ],
              }
            : {}),
        },
      ],
    },
    evidence: c.evidence.map((e, i) => ({ id: `eval-e${i + 1}`, ...e, criterionIds })),
    chapters: c.chapter
      ? [{ id: "eval-ch", outcomeId: OUTCOME, text: c.chapter, aiDrafted: false }]
      : [],
    references: (c.references ?? []).map((apa, i) => ({ id: `eval-r${i + 1}`, apa })),
    ...(c.answers.length
      ? {
          guided: {
            [OUTCOME]: {
              [sectionId]: {
                questions: c.answers.map((a) => a.question),
                answers: c.answers.map((a) => a.answer),
                at: 1,
                model: "eval",
              },
            },
          },
        }
      : {}),
  };
  return { data, outcomeId: OUTCOME, sectionId };
}

export interface QuestionsScore {
  parse: boolean;
  /** Two to four. */
  count: boolean;
  /** No yes/no question. */
  open: boolean;
  /** Nothing forbidden (an injected instruction) obeyed. */
  clean: boolean;
  /** Every expected topic is asked about. */
  topic: boolean;
  pass: boolean;
}

const YES_NO = {
  nl: /^(heb|had|hebben|is|was|ben|zijn|waren|kun|kon|kan|werd|wordt|deed|doe|vind|vond|weet|wist|zou|moet|mocht)\b/i,
  en: /^(did|do|does|is|was|were|are|have|has|had|can|could|would|will|should)\b/i,
} as const;

const has = (text: string, fragment: string) => text.toLowerCase().includes(fragment.toLowerCase());

export function scoreQuestions(c: GuidedCase, questions: string[] | null): QuestionsScore {
  const qs = questions ?? [];
  const score = {
    parse: questions !== null,
    count: qs.length >= 2 && qs.length <= 4,
    open: qs.every((q) => !YES_NO[c.locale].test(q.trim())),
    clean: qs.every((q) => !c.expect.forbidden.some((f) => has(q, f))),
    topic: c.expect.askAbout.every((p) => qs.some((q) => new RegExp(p, "i").test(q))),
  };
  return { ...score, pass: Object.values(score).every(Boolean) };
}

export interface DraftScore {
  parse: boolean;
  words: number;
  /** 60 to 320 words. */
  length: boolean;
  /** Every number in the paragraph (outside an open spot) is in the case's material. */
  noNewNumbers: boolean;
  /** Share of the expected facts kept, 0–1. */
  facts: number;
  /** An open spot where the case leaves a gap (always true when it leaves none). */
  gap: boolean;
  clean: boolean;
  firstPerson: boolean;
  pass: boolean;
}

const NUMBER = /\d+(?:[.,]\d+)?/g;
const FIRST_PERSON = { nl: /\b(ik|mijn|me|mij)\b/i, en: /\b(I|my|me)\b/ } as const;

function material(c: GuidedCase): string {
  return [
    c.section.title,
    c.section.description,
    ...c.criteria.flatMap((x) => [x.text, x.strongLevel]),
    ...c.evidence.flatMap((e) => [e.title, e.text]),
    c.chapter,
    ...(c.references ?? []),
    ...c.answers.flatMap((a) => [a.question, a.answer]),
  ]
    .filter(Boolean)
    .join("\n");
}

function outsideMarkers(text: string): string {
  return splitOnMarkers(text)
    .filter((p) => !p.marker)
    .map((p) => p.text)
    .join(" ");
}

export function scoreDraft(c: GuidedCase, paragraph: string | null): DraftScore {
  const text = paragraph ?? "";
  const source = material(c);
  const words = text.split(/\s+/).filter(Boolean).length;
  const facts = c.expect.facts.length
    ? c.expect.facts.filter((f) => has(text, f)).length / c.expect.facts.length
    : 1;
  const score = {
    parse: paragraph !== null,
    words,
    length: words >= 60 && words <= 320,
    // A number inside an open spot asks the teacher something; it states nothing.
    noNewNumbers: (outsideMarkers(text).match(NUMBER) ?? []).every((n) => source.includes(n)),
    facts,
    gap: !c.expect.gap || markersIn(text).length > 0,
    clean: !c.expect.forbidden.some((f) => has(text, f)),
    firstPerson: FIRST_PERSON[c.locale].test(text),
  };
  return {
    ...score,
    pass:
      score.parse &&
      score.length &&
      score.noNewNumbers &&
      score.facts === 1 &&
      score.gap &&
      score.clean &&
      score.firstPerson,
  };
}

export interface GuidedRow {
  caseId: string;
  questions: QuestionsScore;
  draft: DraftScore;
}

export function guidedReportMarkdown(input: {
  date: string;
  model: string;
  repeat: number;
  rows: GuidedRow[];
}): string {
  const yesNo = (b: boolean) => (b ? "ja" : "nee");
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const passed = input.rows.filter((r) => r.questions.pass && r.draft.pass).length;
  return [
    `# Eval geleid schrijven — ${input.date}`,
    "",
    `Prompts: ${QUESTIONS_PROMPT_ID} (vragen) en ${DRAFT_PROMPT_ID} (alinea). Model: ${input.model}. Herhalingen per case: ${input.repeat}. Deterministische score, geen beoordelaarsmodel.`,
    "",
    "## Vragen",
    "",
    "| Case | Geparsed | 2–4 vragen | Open vragen | Geen instructie gevolgd | Onderwerpen | Geslaagd |",
    "|---|---|---|---|---|---|---|",
    ...input.rows.map(
      (r) =>
        `| ${r.caseId} | ${yesNo(r.questions.parse)} | ${yesNo(r.questions.count)} | ${yesNo(r.questions.open)} | ${yesNo(r.questions.clean)} | ${yesNo(r.questions.topic)} | ${yesNo(r.questions.pass)} |`,
    ),
    "",
    "## Alinea",
    "",
    "| Case | Geparsed | Woorden | Geen nieuwe getallen | Feiten | Open plek waar nodig | Geen instructie gevolgd | Ik-vorm | Geslaagd |",
    "|---|---|---|---|---|---|---|---|---|",
    ...input.rows.map(
      (r) =>
        `| ${r.caseId} | ${yesNo(r.draft.parse)} | ${r.draft.words} | ${yesNo(r.draft.noNewNumbers)} | ${pct(r.draft.facts)} | ${yesNo(r.draft.gap)} | ${yesNo(r.draft.clean)} | ${yesNo(r.draft.firstPerson)} | ${yesNo(r.draft.pass)} |`,
    ),
    "",
    `Geslaagd: ${passed} van ${input.rows.length}.`,
    "",
  ].join("\n");
}
