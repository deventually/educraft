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
import { citesUnknownSource, criteriaMaterial, unknownCitations } from "./coach";
import { GUIDED_LIMITS } from "./schema";
import type { DossierData, Outcome } from "./types";

export const QUESTIONS_PROMPT_ID = "portfolio-questions@v1";
export const DRAFT_PROMPT_ID = "portfolio-draft@v2";

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

/** The user message asking questions about one section. All teacher material is data. */
export function buildQuestionsMessage(
  d: DossierData,
  outcomeId: string,
  sectionId: string,
  locale: Locale,
): string {
  const s = sectionOf(d, outcomeId, sectionId);
  const chapter = d.chapters.find((ch) => ch.outcomeId === outcomeId)?.text ?? "";
  const m = criteriaMaterial(d, outcomeId, s.criterionIds, chapter, locale);
  return [m.outcome, sectionBlock(s, locale), m.criteria, m.evidence, m.chapter].join("\n\n");
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

/**
 * The user message for one section's paragraph: the questions with the teacher's answers,
 * the section's evidence, the chapter so far and the references. `null` when there is
 * nothing honest to write from (no answer and no evidence with text).
 */
export function buildSectionDraftMessage(
  d: DossierData,
  outcomeId: string,
  sectionId: string,
  chapter: string,
  locale: Locale,
): string | null {
  const s = sectionOf(d, outcomeId, sectionId);
  const l = LABELS[locale];
  const m = criteriaMaterial(d, outcomeId, s.criterionIds, chapter, locale);
  const saved = d.guided?.[outcomeId]?.[sectionId];
  const pairs = (saved?.questions ?? []).map((q, i) => ({ q, a: saved?.answers[i]?.trim() ?? "" }));
  if (!m.hasEvidence && !pairs.some((p) => p.a)) return null;
  const answers = pairs.length
    ? pairs
        .map(
          (p, i) =>
            `<qa n="${i + 1}">\n${l.question}: ${p.q}\n${l.answer}: ${p.a || l.noAnswer}\n</qa>`,
        )
        .join("\n")
    : l.noAnswer;
  return [
    m.outcome,
    sectionBlock(s, locale),
    m.criteria,
    `<answers>\n${answers}\n</answers>`,
    m.evidence,
    m.chapter,
    m.references,
  ].join("\n\n");
}

/** The paragraph without fences or a heading; `null` when empty or citing an unknown source. */
export type SectionDraftCheck = { ok: true; text: string } | { ok: false; unknown: string[] };

/** The paragraph, cleaned, or why it is refused: empty, or naming sources the teacher lacks. */
export function checkSectionDraft(raw: string, references: string[]): SectionDraftCheck {
  const fenced = /```[a-z]*\s*([\s\S]*?)```/i.exec(raw)?.[1];
  const text = (fenced ?? raw)
    .split("\n")
    .filter((line) => !/^\s*#{1,6}\s/.test(line))
    .join("\n")
    .trim()
    .slice(0, 5_000);
  if (!text) return { ok: false, unknown: [] };
  const unknown = unknownCitations(text, references);
  return unknown.length ? { ok: false, unknown } : { ok: true, text };
}

export function parseSectionDraft(raw: string, references: string[]): string | null {
  const r = checkSectionDraft(raw, references);
  return r.ok ? r.text : null;
}

const CORRECTION: Record<Locale, (list: string) => string> = {
  nl: (list) =>
    `<correction>\nJe vorige tekst noemde bronnen die niet in <references> staan: ${list}. Noem ze niet. Zet op die plek [aanvullen: bron in je literatuurlijst] en schrijf de alinea opnieuw.\n</correction>`,
  en: (list) =>
    `<correction>\nYour previous text named sources that are not in <references>: ${list}. Do not name them. Put [to add: source in your reference list] in their place and write the paragraph again.\n</correction>`,
};

/** The draft message for a second try, told which sources to leave out. */
export function retryDraftMessage(message: string, unknown: string[], locale: Locale): string {
  return unknown.length ? `${message}\n\n${CORRECTION[locale](unknown.join(", "))}` : message;
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
