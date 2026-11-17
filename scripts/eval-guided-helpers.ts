/**
 * Pure helpers for the guided-writing eval (`npm run eval:guided`): build a dossier from a
 * synthetic case, and score the questions and the paragraph deterministically (no judge model).
 */
import { aiPatternsIn } from "../app/lib/portfolio/aiPatterns";
import { markersIn, splitOnMarkers } from "../app/lib/portfolio/openSpots";
import { emptyDossier } from "../app/lib/portfolio/schema";
import {
  DRAFT_PROMPT_ID,
  FOLLOW_UP_PROMPT_ID,
  QUESTIONS_PROMPT_ID,
} from "../app/lib/portfolio/guided";
import { anchorFacts, factsBlock } from "../app/lib/portfolio/courseFacts";
import type { CourseData } from "../app/lib/courses/types";
import type { DossierData, EvidenceKind } from "../app/lib/portfolio/types";
import { type VoiceRow, voiceSection } from "./eval-guided-voice";

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
  /** The outcome's anchor: a course (missing lists are empty) and, for a lesson or test, its id. */
  course?: { name: string; data: Partial<CourseData>; itemId?: string };
  expect: {
    /** Patterns (case-insensitive); each must match at least one question. */
    askAbout: string[];
    /** Patterns (case-insensitive) no question may match: facts the course already gives. */
    notAskAbout?: string[];
    /** Text that must appear in no question and not in the paragraph (e.g. an injected word). */
    forbidden: string[];
    /** Fragments from the answers or evidence the paragraph must keep. */
    facts: string[];
    /** The material leaves a gap: the paragraph must hold an open spot. */
    gap: boolean;
    /** Patterns (case-insensitive); each must match a follow-up: a vague or missing answer. */
    followUpAbout?: string[];
    /** A known-good answer for each step, for the scorer's own test. */
    goodQuestions: string[];
    goodFollowUps?: string[];
    goodParagraph: string;
  };
}

const OUTCOME = "eval-outcome";
const SECTION = "eval-section";

/** The `<course>` block the app would send for the case's anchor; "" without one. */
export function caseCourse(c: GuidedCase): string {
  if (!c.course) return "";
  const data: CourseData = { outcomes: [], activities: [], assessments: [], ...c.course.data };
  const ref = { courseId: "eval-course", ...(c.course.itemId ? { itemId: c.course.itemId } : {}) };
  return factsBlock(anchorFacts({ name: c.course.name, data }, ref, c.locale), c.locale);
}

/**
 * The dossier the app would hold for this case: confirmed, in draft mode, answers saved; with
 * the `<course>` block of its anchor ("" without one).
 */
export function caseDossier(c: GuidedCase): {
  data: DossierData;
  outcomeId: string;
  sectionId: string;
  course: string;
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
  return { data, outcomeId: OUTCOME, sectionId, course: caseCourse(c) };
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
  /** Nothing asked that the course already says. */
  known: boolean;
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
    known: (c.expect.notAskAbout ?? []).every((p) => !qs.some((q) => new RegExp(p, "i").test(q))),
  };
  return { ...score, pass: Object.values(score).every(Boolean) };
}

export interface FollowUpScore {
  parse: boolean;
  /** Zero to two. */
  count: boolean;
  open: boolean;
  clean: boolean;
  /** Where the case has a vague or missing answer, the follow-up asks about it. */
  topic: boolean;
  pass: boolean;
}

export function scoreFollowUps(c: GuidedCase, questions: string[] | null): FollowUpScore {
  const qs = questions ?? [];
  const score = {
    parse: questions !== null,
    count: qs.length <= 2,
    open: qs.every((q) => !YES_NO[c.locale].test(q.trim())),
    clean: qs.every((q) => !c.expect.forbidden.some((f) => has(q, f))),
    topic: (c.expect.followUpAbout ?? []).every((p) => qs.some((q) => new RegExp(p, "i").test(q))),
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
  /** No generic, AI-like phrasing (`aiPatternsIn`) outside an open spot. */
  natural: boolean;
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
    caseCourse(c),
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
    natural: aiPatternsIn(outsideMarkers(text)).length === 0,
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
      score.firstPerson &&
      score.natural,
  };
}

export interface GuidedRow extends VoiceRow {
  questions: QuestionsScore;
  draft: DraftScore;
  /** Measured when the run asked for follow-ups as well. */
  followUps?: FollowUpScore;
}

export function guidedReportMarkdown(input: {
  date: string;
  model: string;
  repeat: number;
  rows: GuidedRow[];
  /** The paragraph prompt measured; the app's current one by default. */
  draftPrompt?: string;
  /** Whether a first paragraph in generic phrasing got a second try, as the app does. */
  styleRetry?: boolean;
  /** The voice judge, when the run asked for it (`--voice`). */
  judgeModel?: string;
}): string {
  const draftPrompt = input.draftPrompt ?? DRAFT_PROMPT_ID;
  const retry = input.styleRetry ?? true;
  const yesNo = (b: boolean) => (b ? "ja" : "nee");
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const passed = input.rows.filter(
    (r) => r.questions.pass && r.draft.pass && (r.followUps?.pass ?? true),
  ).length;
  return [
    `# Eval geleid schrijven — ${input.date}`,
    "",
    `Prompts: ${QUESTIONS_PROMPT_ID} (vragen) en ${draftPrompt} (alinea), ${retry ? "met" : "zonder"} tweede poging bij algemene wendingen. Model: ${input.model}. Herhalingen per case: ${input.repeat}. ${input.judgeModel ? "Deterministische score, en een beoordelaarsmodel voor de stem." : "Deterministische score, geen beoordelaarsmodel."}`,
    "",
    "## Vragen",
    "",
    "| Case | Geparsed | 2–4 vragen | Open vragen | Geen instructie gevolgd | Onderwerpen | Niets gevraagd wat de cursus al zegt | Geslaagd |",
    "|---|---|---|---|---|---|---|---|",
    ...input.rows.map(
      (r) =>
        `| ${r.caseId} | ${yesNo(r.questions.parse)} | ${yesNo(r.questions.count)} | ${yesNo(r.questions.open)} | ${yesNo(r.questions.clean)} | ${yesNo(r.questions.topic)} | ${yesNo(r.questions.known)} | ${yesNo(r.questions.pass)} |`,
    ),
    "",
    "## Alinea",
    "",
    "| Case | Geparsed | Woorden | Geen nieuwe getallen | Feiten | Open plek waar nodig | Geen instructie gevolgd | Ik-vorm | Geen AI-wendingen | Geslaagd |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...input.rows.map(
      (r) =>
        `| ${r.caseId} | ${yesNo(r.draft.parse)} | ${r.draft.words} | ${yesNo(r.draft.noNewNumbers)} | ${pct(r.draft.facts)} | ${yesNo(r.draft.gap)} | ${yesNo(r.draft.clean)} | ${yesNo(r.draft.firstPerson)} | ${yesNo(r.draft.natural)} | ${yesNo(r.draft.pass)} |`,
    ),
    ...followUpSection(input.rows),
    ...voiceSection(input.rows, input.judgeModel ?? ""),
    "",
    `Geslaagd: ${passed} van ${input.rows.length}.`,
    "",
  ].join("\n");
}

function followUpSection(rows: GuidedRow[]): string[] {
  const measured = rows.filter((r) => r.followUps);
  if (measured.length === 0) return [];
  const yesNo = (b: boolean) => (b ? "ja" : "nee");
  return [
    "",
    "## Doorvragen",
    "",
    `Prompt: ${FOLLOW_UP_PROMPT_ID}. Nul tot twee vervolgvragen; bij een vaag of leeg antwoord moet er één over gaan.`,
    "",
    "| Case | Geparsed | 0–2 vragen | Open vragen | Geen instructie gevolgd | Vraagt door waar nodig | Geslaagd |",
    "|---|---|---|---|---|---|---|",
    ...measured.map((r) => {
      const f = r.followUps as FollowUpScore;
      return `| ${r.caseId} | ${yesNo(f.parse)} | ${yesNo(f.count)} | ${yesNo(f.open)} | ${yesNo(f.clean)} | ${yesNo(f.topic)} | ${yesNo(f.pass)} |`;
    }),
  ];
}
