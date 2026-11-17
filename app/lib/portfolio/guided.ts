/**
 * Guided writing per section (BDB/BKE plan, step 6), the pure half. The coach asks two to
 * four questions about one section of a chapter; the teacher answers in their own words. In
 * draft mode the answers and the linked evidence become a paragraph, with `[aanvullen: …]`
 * where something is missing. No server, no provider: `portfolioGuided.server.ts` calls the
 * model.
 *
 * A section is a section of the form's outline (step 5), or, when the form prescribes none,
 * one criterion. Anti-fabrication lives here as well as in the prompts: a question or a
 * paragraph that cites a source the teacher's reference list lacks is refused.
 */
import { z } from "zod";
import { extractJson } from "~/lib/ai/structuredAnswer";
import type { Locale } from "~/lib/i18n";
import { aiPatternsIn } from "./aiPatterns";
import { citesUnknownSource, criteriaMaterial, unknownCitations } from "./coach";
import { splitOnMarkers } from "./openSpots";
import { GUIDED_LIMITS } from "./schema";
import type { DossierData, Outcome } from "./types";

export const QUESTIONS_PROMPT_ID = "portfolio-questions@v2";
export const DRAFT_PROMPT_ID = "portfolio-draft@v4";
export const FOLLOW_UP_PROMPT_ID = "portfolio-followup@v1";

/** One part of a chapter to write. */
export interface WritingSection {
  id: string;
  title: string;
  description?: string;
  criterionIds: string[];
  /** From the form's outline; otherwise the section is one criterion. */
  fromOutline: boolean;
  /** 1-based position: of the section in the outline, or of the criterion in the outcome. */
  n: number;
  unverified?: true;
}

/** One part of the chapter as the page shows it: the section, its questions and the answers. */
export interface GuidedSectionView extends WritingSection {
  /** 1-based numbers of the criteria it covers. */
  covers: number[];
  questions: string[];
  answers: string[];
  /** A paragraph from these answers is in the chapter. */
  drafted: boolean;
}

/** Every section of the outcome's chapter with what the teacher was asked and answered. */
export function guidedView(d: DossierData, outcome: Outcome): GuidedSectionView[] {
  const number = new Map(outcome.criteria.map((c, i) => [c.id, i + 1]));
  return writingSections(outcome).map((s) => {
    const saved = d.guided?.[outcome.id]?.[s.id];
    return {
      ...s,
      covers: s.criterionIds.flatMap((id) => number.get(id) ?? []).sort((a, b) => a - b),
      questions: saved?.questions ?? [],
      answers: saved?.questions.map((_, i) => saved.answers[i] ?? "") ?? [],
      drafted: saved?.draftedAt !== undefined,
    };
  });
}

/** The form's outline, or one section per criterion when the form gives none. */
export function writingSections(o: Outcome): WritingSection[] {
  if (o.outline?.length) {
    return o.outline.map((s, i) => ({
      id: s.id,
      title: s.title,
      ...(s.description ? { description: s.description } : {}),
      criterionIds: s.criterionIds,
      fromOutline: true,
      n: i + 1,
      ...(s.unverified ? { unverified: true as const } : {}),
    }));
  }
  return o.criteria.map((c, i) => ({
    id: c.id,
    title: c.text,
    criterionIds: [c.id],
    fromOutline: false,
    n: i + 1,
  }));
}

function sectionOf(d: DossierData, outcomeId: string, sectionId: string): WritingSection {
  const o = d.framework.outcomes.find((x) => x.id === outcomeId);
  if (!o) throw new Error(`Unknown outcome: ${outcomeId}`);
  const s = writingSections(o).find((x) => x.id === sectionId);
  if (!s) throw new Error(`Unknown section: ${sectionId}`);
  return s;
}

const LABELS = {
  nl: {
    title: "Titel",
    asks: "Wat het formulier hier vraagt",
    criterion: "Dit onderdeel is één criterium (het formulier geeft geen opzet).",
    noAnswer: "(geen antwoord)",
    question: "Vraag",
    answer: "Antwoord van de docent",
  },
  en: {
    title: "Title",
    asks: "What the form asks here",
    criterion: "This part is one criterion (the form gives no outline).",
    noAnswer: "(no answer)",
    question: "Question",
    answer: "The teacher's answer",
  },
} as const;

function sectionBlock(s: WritingSection, locale: Locale): string {
  const l = LABELS[locale];
  const lines = s.fromOutline
    ? [`${l.title}: ${s.title}`, ...(s.description ? [`${l.asks}: ${s.description}`] : [])]
    : [l.criterion];
  return `<section>\n${lines.join("\n")}\n</section>`;
}

/**
 * The user message asking questions about one section. All teacher material is data; `course`
 * is what the anchor's course already says (`factsBlock`), "" without an anchor.
 */
export function buildQuestionsMessage(
  d: DossierData,
  outcomeId: string,
  sectionId: string,
  locale: Locale,
  course = "",
): string {
  const s = sectionOf(d, outcomeId, sectionId);
  const chapter = d.chapters.find((ch) => ch.outcomeId === outcomeId)?.text ?? "";
  const m = criteriaMaterial(d, outcomeId, s.criterionIds, chapter, locale);
  return [m.outcome, course, sectionBlock(s, locale), m.criteria, m.evidence, m.chapter]
    .filter(Boolean)
    .join("\n\n");
}

const RawQuestions = z.object({ questions: z.array(z.unknown()) });

/** Two to four distinct, clipped questions; `null` when fewer usable ones came back. */
export function parseQuestions(raw: string, references: string[]): string[] | null {
  const parsed = RawQuestions.safeParse(extractJson(raw));
  if (!parsed.success) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of parsed.data.questions) {
    if (typeof q !== "string") continue;
    const text = q.replace(/\s+/g, " ").trim().slice(0, GUIDED_LIMITS.question);
    const key = text.toLowerCase();
    if (!text || seen.has(key) || citesUnknownSource(text, references)) continue;
    seen.add(key);
    out.push(text);
  }
  return out.length >= GUIDED_LIMITS.minQuestions ? out.slice(0, GUIDED_LIMITS.questions) : null;
}

type AnswerPair = { q: string; a: string };

function answerPairs(d: DossierData, outcomeId: string, sectionId: string): AnswerPair[] {
  const saved = d.guided?.[outcomeId]?.[sectionId];
  return (saved?.questions ?? []).map((q, i) => ({ q, a: saved?.answers[i]?.trim() ?? "" }));
}

/** The coach's questions with the teacher's answers, as `<answers>`. */
function answersBlock(pairs: AnswerPair[], locale: Locale): string {
  const l = LABELS[locale];
  const body = pairs.length
    ? pairs
        .map(
          (p, i) =>
            `<qa n="${i + 1}">\n${l.question}: ${p.q}\n${l.answer}: ${p.a || l.noAnswer}\n</qa>`,
        )
        .join("\n")
    : l.noAnswer;
  return `<answers>\n${body}\n</answers>`;
}

/**
 * The user message for following up on one section: what the questions message holds, plus
 * the questions asked so far with the teacher's answers.
 */
export function buildFollowUpMessage(
  d: DossierData,
  outcomeId: string,
  sectionId: string,
  locale: Locale,
  course = "",
): string {
  const asked = buildQuestionsMessage(d, outcomeId, sectionId, locale, course);
  return `${asked}\n\n${answersBlock(answerPairs(d, outcomeId, sectionId), locale)}`;
}

/**
 * Zero to two new follow-up questions, clipped, none already asked and no more than the
 * section has room for; `null` when the answer is unusable. An empty list is a good answer:
 * the answers are concrete enough.
 */
export function parseFollowUps(
  raw: string,
  references: string[],
  asked: string[],
): string[] | null {
  const parsed = RawQuestions.safeParse(extractJson(raw));
  if (!parsed.success) return null;
  const seen = new Set(asked.map((q) => q.toLowerCase()));
  const out: string[] = [];
  for (const q of parsed.data.questions) {
    if (typeof q !== "string") continue;
    const text = q.replace(/\s+/g, " ").trim().slice(0, GUIDED_LIMITS.question);
    const key = text.toLowerCase();
    if (!text || seen.has(key) || citesUnknownSource(text, references)) continue;
    seen.add(key);
    out.push(text);
  }
  const room = Math.max(0, GUIDED_LIMITS.total - asked.length);
  return out.slice(0, Math.min(GUIDED_LIMITS.followUps, room));
}

/** The section with the follow-ups added, each with an empty answer; it may be written again. */
export function withFollowUps(
  d: DossierData,
  outcomeId: string,
  sectionId: string,
  followUps: string[],
): DossierData {
  const s = d.guided?.[outcomeId]?.[sectionId];
  if (!s || followUps.length === 0) return d;
  const { draftedAt: _, ...rest } = s;
  const next = {
    ...rest,
    questions: [...s.questions, ...followUps],
    answers: [...s.questions.map((_, i) => s.answers[i] ?? ""), ...followUps.map(() => "")],
  };
  return {
    ...d,
    guided: { ...d.guided, [outcomeId]: { ...d.guided?.[outcomeId], [sectionId]: next } },
  };
}

/** Following up makes sense once something is answered and the section has room left. */
export function canFollowUp(s: { questions: string[]; answers: string[] }): boolean {
  return s.questions.length < GUIDED_LIMITS.total && s.answers.some((a) => a.trim() !== "");
}

/**
 * The user message for one section's paragraph: the questions with the teacher's answers,
 * the course's facts, the section's evidence, the chapter so far and the references. `null`
 * when there is nothing honest to write from (no answer, no evidence with text, no facts).
 */
export function buildSectionDraftMessage(
  d: DossierData,
  outcomeId: string,
  sectionId: string,
  chapter: string,
  locale: Locale,
  course = "",
): string | null {
  const s = sectionOf(d, outcomeId, sectionId);
  const m = criteriaMaterial(d, outcomeId, s.criterionIds, chapter, locale);
  const pairs = answerPairs(d, outcomeId, sectionId);
  if (!m.hasEvidence && !course && !pairs.some((p) => p.a)) return null;
  return [
    m.outcome,
    course,
    sectionBlock(s, locale),
    m.criteria,
    answersBlock(pairs, locale),
    m.evidence,
    m.chapter,
    m.references,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** The paragraph without fences or a heading; `null` when empty or citing an unknown source. */
export type SectionDraftCheck =
  | { ok: true; text: string }
  | { ok: false; unknown: string[]; generic?: string[] };

/**
 * The paragraph, cleaned, or why it is refused: empty, or naming sources the teacher lacks.
 * With `style` (a first try) also refused for generic, AI-like phrasing outside an open spot
 * (`aiPatternsIn`), so a second try can rewrite it; a second try is never refused for style.
 */
export function checkSectionDraft(
  raw: string,
  references: string[],
  opts: { style?: boolean } = {},
): SectionDraftCheck {
  const fenced = /```[a-z]*\s*([\s\S]*?)```/i.exec(raw)?.[1];
  const text = (fenced ?? raw)
    .split("\n")
    .filter((line) => !/^\s*#{1,6}\s/.test(line))
    .join("\n")
    .trim()
    .slice(0, 5_000);
  if (!text) return { ok: false, unknown: [] };
  const unknown = unknownCitations(text, references);
  if (unknown.length) return { ok: false, unknown };
  if (opts.style) {
    const prose = splitOnMarkers(text)
      .filter((p) => !p.marker)
      .map((p) => p.text)
      .join(" ");
    const generic = [...new Set(aiPatternsIn(prose).map((p) => p.text))];
    if (generic.length) return { ok: false, unknown: [], generic };
  }
  return { ok: true, text };
}

export function parseSectionDraft(raw: string, references: string[]): string | null {
  const r = checkSectionDraft(raw, references);
  return r.ok ? r.text : null;
}

const CORRECTION: Record<Locale, (list: string) => string> = {
  nl: (list) =>
    `Je vorige tekst noemde bronnen die niet in <references> staan: ${list}. Noem ze niet. Zet op die plek [aanvullen: bron in je literatuurlijst] en schrijf de alinea opnieuw.`,
  en: (list) =>
    `Your previous text named sources that are not in <references>: ${list}. Do not name them. Put [to add: source in your reference list] in their place and write the paragraph again.`,
};

const STYLE: Record<Locale, (list: string) => string> = {
  nl: (list) =>
    `Je vorige tekst had algemene wendingen: ${list}. Schrijf de alinea opnieuw zonder deze woorden en zonder gedachtestreepjes of samenvattende slotzin. Zeg in plaats daarvan concreet wat de docent deed, zag of hoorde, met de woorden van de docent.`,
  en: (list) =>
    `Your previous text had generic phrasing: ${list}. Write the paragraph again without these words and without dashes or a summarising closing sentence. Say instead, concretely, what the teacher did, saw or heard, in the teacher's words.`,
};

/** The draft message for a second try, told which sources to leave out and which phrases to drop. */
export function retryDraftMessage(
  message: string,
  unknown: string[],
  locale: Locale,
  generic: string[] = [],
): string {
  const notes = [
    ...(unknown.length ? [CORRECTION[locale](unknown.join(", "))] : []),
    ...(generic.length ? [STYLE[locale](generic.join(", "))] : []),
  ];
  return notes.length ? `${message}\n\n<correction>\n${notes.join("\n")}\n</correction>` : message;
}

/** The chapter with the paragraph appended; an outline section's title goes above it, once. */
export function appendSection(chapter: string, s: WritingSection, paragraph: string): string {
  const base = chapter.trimEnd();
  const heading = `## ${s.title}`;
  const hasHeading =
    s.fromOutline &&
    base.split("\n").some((line) => line.trim().toLowerCase() === heading.toLowerCase());
  const block = s.fromOutline && !hasHeading ? `${heading}\n\n${paragraph}` : paragraph;
  return base ? `${base}\n\n${block}` : block;
}

/**
 * Stores the answers typed beside the chapter (`sectionId` → one per question). Sections the
 * coach asked nothing about are ignored; answers are trimmed and clipped.
 */
export function withAnswers(
  d: DossierData,
  outcomeId: string,
  answers: Record<string, string[]>,
): DossierData {
  const current = d.guided?.[outcomeId];
  if (!current) return d;
  const next = { ...current };
  for (const [sectionId, list] of Object.entries(answers)) {
    const s = next[sectionId];
    if (!s) continue;
    next[sectionId] = {
      ...s,
      answers: s.questions.map((_, i) => (list[i] ?? "").trim().slice(0, GUIDED_LIMITS.answer)),
    };
  }
  return { ...d, guided: { ...d.guided, [outcomeId]: next } };
}
