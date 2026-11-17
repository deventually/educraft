/**
 * Guided writing per section (BDB/BKE plan, step 6), the server half: gates, the model calls,
 * the checks from `guided.ts`, usage accounting and the `aiLog` line. Returns the next dossier
 * data; the caller stores it. Never sets a status.
 */
import {
  appendSection,
  buildQuestionsMessage,
  buildSectionDraftMessage,
  DRAFT_PROMPT_ID,
  parseQuestions,
  checkSectionDraft,
  retryDraftMessage,
  QUESTIONS_PROMPT_ID,
  writingSections,
  type WritingSection,
} from "~/lib/portfolio/guided";
import { writeChapter } from "~/lib/portfolio/edit";
import { LIMITS } from "~/lib/portfolio/schema";
import type { AiLogEntry, DossierData } from "~/lib/portfolio/types";
import type { Locale } from "~/lib/i18n";
import type { User } from "./auth.server";
import { callPortfolioModel, quotaGate } from "./portfolioAi.server";
import { log } from "./log.server";

export type GuidedError =
  | "not-confirmed"
  | "not-draft-mode"
  | "no-material"
  | "all-drafted"
  | "quota"
  | "failed";
/** `drafted`/`failed`: how many sections the whole-chapter intents wrote or could not. */
export type GuidedResult =
  | { ok: true; data: DossierData; drafted?: number; failed?: number; followUps?: number }
  | { ok: false; error: GuidedError };

export function withLog(d: DossierData, entry: AiLogEntry): DossierData {
  return { ...d, aiLog: [...d.aiLog, entry].slice(-LIMITS.aiLog) };
}

export const references = (d: DossierData) => d.references.map((r) => r.apa);

/** How many sections ask for questions at the same time (`askAllQuestions`). */
export const PARALLEL = 4;

/** Two to four checked questions about one section, with the model; `null` when none came. */
export async function questionsFor(
  user: User,
  d: DossierData,
  outcomeId: string,
  sectionId: string,
  locale: Locale,
  course: string,
): Promise<{ questions: string[]; model: string } | null> {
  const message = buildQuestionsMessage(d, outcomeId, sectionId, locale, course);
  // One retry: a malformed answer is rare, and the second call usually fixes it.
  for (let attempt = 0; attempt < 2; attempt++) {
    const answer = await callPortfolioModel(user, QUESTIONS_PROMPT_ID, message, locale, 800);
    if (!answer) break;
    const questions = parseQuestions(answer.text, references(d));
    if (questions) return { questions, model: answer.model };
    log("portfolio-guided", { outcome: "rejected", step: "questions", attempt });
  }
  return null;
}

/** The dossier with one section's new questions (earlier answers and draft mark go). */
export function withQuestions(
  d: DossierData,
  outcomeId: string,
  sectionId: string,
  asked: { questions: string[]; model: string },
  now: number,
): DossierData {
  const section = { questions: asked.questions, answers: [], at: now, model: asked.model };
  return withLog(
    {
      ...d,
      guided: { ...d.guided, [outcomeId]: { ...d.guided?.[outcomeId], [sectionId]: section } },
    },
    // Questions are coaching, not text: the disclosure names them with the feedback.
    { at: now, action: "review", outcomeId, model: asked.model },
  );
}

/**
 * Asks two to four questions about one section and stores them, replacing earlier ones.
 * `course` is what the anchor's course already says (`factsBlock`), "" without one.
 */
export async function askQuestions(
  user: User,
  d: DossierData,
  outcomeId: string,
  sectionId: string,
  locale: Locale,
  now = Date.now(),
  course = "",
): Promise<GuidedResult> {
  if (d.framework.confirmedAt === undefined) return { ok: false, error: "not-confirmed" };
  const blocked = await quotaGate(user);
  if (blocked) return { ok: false, error: blocked };
  const asked = await questionsFor(user, d, outcomeId, sectionId, locale, course);
  if (!asked) return { ok: false, error: "failed" };
  return { ok: true, data: withQuestions(d, outcomeId, sectionId, asked, now) };
}

export function sectionsOf(d: DossierData, outcomeId: string): WritingSection[] {
  const outcome = d.framework.outcomes.find((o) => o.id === outcomeId);
  if (!outcome) throw new Error(`Unknown outcome: ${outcomeId}`);
  return writingSections(outcome);
}

/**
 * The questions for every section of the chapter that has none yet, a few at a time, so the
 * teacher answers them all on one screen. Sections already asked keep their questions and
 * answers; a section whose questions fail is counted in `failed` and keeps its own button.
 */
export async function askAllQuestions(
  user: User,
  d: DossierData,
  outcomeId: string,
  locale: Locale,
  now = Date.now(),
  course = "",
): Promise<GuidedResult> {
  if (d.framework.confirmedAt === undefined) return { ok: false, error: "not-confirmed" };
  const open = sectionsOf(d, outcomeId).filter(
    (s) => !d.guided?.[outcomeId]?.[s.id]?.questions.length,
  );
  if (open.length === 0) return { ok: true, data: d, failed: 0 };
  const blocked = await quotaGate(user);
  if (blocked) return { ok: false, error: blocked };
  let data = d;
  let failed = 0;
  for (let i = 0; i < open.length; i += PARALLEL) {
    const batch = open.slice(i, i + PARALLEL);
    const asked = await Promise.all(
      batch.map((s) => questionsFor(user, d, outcomeId, s.id, locale, course).catch(() => null)),
    );
    asked.forEach((a, j) => {
      const s = batch[j];
      if (a && s) data = withQuestions(data, outcomeId, s.id, a, now);
      else failed++;
    });
  }
  if (failed === open.length) return { ok: false, error: "failed" };
  return { ok: true, data, failed };
}

/** One section's paragraph appended to `currentText`, the chapter stored and the section marked. */
async function draftOne(
  user: User,
  d: DossierData,
  outcomeId: string,
  section: WritingSection,
  currentText: string,
  locale: Locale,
  now: number,
  course: string,
): Promise<{ ok: true; data: DossierData; text: string } | { ok: false; error: GuidedError }> {
  const built = buildSectionDraftMessage(d, outcomeId, section.id, currentText, locale, course);
  if (!built) return { ok: false, error: "no-material" };
  let message = built;
  for (let attempt = 0; attempt < 2; attempt++) {
    const answer = await callPortfolioModel(user, DRAFT_PROMPT_ID, message, locale, 1_500);
    if (!answer) break;
    const checked = checkSectionDraft(answer.text, references(d), { style: attempt === 0 });
    if (checked.ok) {
      const text = appendSection(currentText, section, checked.text);
      const saved = d.guided?.[outcomeId]?.[section.id];
      const marked: DossierData = saved
        ? {
            ...d,
            guided: {
              ...d.guided,
              [outcomeId]: { ...d.guided?.[outcomeId], [section.id]: { ...saved, draftedAt: now } },
            },
          }
        : d;
      const data = withLog(writeChapter(marked, outcomeId, text, { aiDrafted: true }), {
        at: now,
        action: "draft",
        outcomeId,
        model: answer.model,
      });
      return { ok: true, data, text };
    }
    log("portfolio-guided", { outcome: "rejected", step: "draft", attempt });
    message = retryDraftMessage(message, checked.unknown, locale, checked.generic);
  }
  return { ok: false, error: "failed" };
}

/**
 * Drafts the text for one section from the teacher's answers and linked evidence, and appends
 * it to the chapter (`currentText` = what the teacher had in the textarea, so unsaved edits are
 * kept) under the section's title. `course` as in `askQuestions`.
 */
export async function draftSection(
  user: User,
  d: DossierData,
  outcomeId: string,
  sectionId: string,
  currentText: string,
  locale: Locale,
  now = Date.now(),
  course = "",
): Promise<GuidedResult> {
  if (d.coachMode !== "draft") return { ok: false, error: "not-draft-mode" };
  if (d.framework.confirmedAt === undefined) return { ok: false, error: "not-confirmed" };
  const section = sectionsOf(d, outcomeId).find((s) => s.id === sectionId);
  if (!section) return { ok: false, error: "failed" };
  if (!buildSectionDraftMessage(d, outcomeId, sectionId, currentText, locale, course))
    return { ok: false, error: "no-material" };
  const blocked = await quotaGate(user);
  if (blocked) return { ok: false, error: blocked };
  const r = await draftOne(user, d, outcomeId, section, currentText, locale, now, course);
  return r.ok ? { ok: true, data: r.data } : r;
}

/**
 * The whole chapter from one click: every section not yet drafted that has material, one by
 * one and in the outline's order, each written with the chapter so far (the sections before
 * it included), so the quality is that of drafting them one at a time. A failed section is
 * counted and skipped; it keeps its own button. Stops at the quota.
 */
export async function draftChapter(
  user: User,
  d: DossierData,
  outcomeId: string,
  currentText: string,
  locale: Locale,
  now = Date.now(),
  course = "",
): Promise<GuidedResult> {
  if (d.coachMode !== "draft") return { ok: false, error: "not-draft-mode" };
  if (d.framework.confirmedAt === undefined) return { ok: false, error: "not-confirmed" };
  const sections = sectionsOf(d, outcomeId);
  const saved = d.guided?.[outcomeId];
  const todo = sections.filter(
    (s) =>
      saved?.[s.id]?.draftedAt === undefined &&
      buildSectionDraftMessage(d, outcomeId, s.id, currentText, locale, course) !== null,
  );
  if (todo.length === 0) {
    const anyDrafted = sections.some((s) => saved?.[s.id]?.draftedAt !== undefined);
    return { ok: false, error: anyDrafted ? "all-drafted" : "no-material" };
  }
  let data = d;
  let text = currentText;
  let drafted = 0;
  let failed = 0;
  for (const [i, section] of todo.entries()) {
    const blocked = await quotaGate(user);
    if (blocked) {
      if (drafted === 0) return { ok: false, error: blocked };
      failed += todo.length - i;
      break;
    }
    const r = await draftOne(user, data, outcomeId, section, text, locale, now, course).catch(
      () => ({ ok: false as const, error: "failed" as const }),
    );
    if (r.ok) {
      data = r.data;
      text = r.text;
      drafted++;
    } else failed++;
  }
  if (drafted === 0) return { ok: false, error: "failed" };
  return { ok: true, data, drafted, failed };
}
