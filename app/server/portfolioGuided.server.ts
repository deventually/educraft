/**
 * Guided writing per section (BDB/BKE plan, step 6), the server half: gates, the model calls,
 * the checks from `guided.ts`, usage accounting and the `aiLog` line. Returns the next dossier
 * data; the caller stores it. Never sets a status.
 */
import { z } from "zod";
import {
  appendSection,
  buildQuestionsMessage,
  buildSectionDraftMessage,
  DRAFT_PROMPT_ID,
  parseQuestions,
  checkSectionDraft,
  retryDraftMessage,
  QUESTIONS_PROMPT_ID,
  withAnswers,
  writingSections,
} from "~/lib/portfolio/guided";
import { writeChapter } from "~/lib/portfolio/edit";
import { GUIDED_LIMITS, LIMITS } from "~/lib/portfolio/schema";
import type { AiLogEntry, DossierData } from "~/lib/portfolio/types";
import type { Locale } from "~/lib/i18n";
import type { User } from "./auth.server";
import { callPortfolioModel, quotaGate } from "./portfolioAi.server";
import { log } from "./log.server";

export type GuidedError = "not-confirmed" | "not-draft-mode" | "no-material" | "quota" | "failed";
type GuidedResult = { ok: true; data: DossierData } | { ok: false; error: GuidedError };

function withLog(d: DossierData, entry: AiLogEntry): DossierData {
  return { ...d, aiLog: [...d.aiLog, entry].slice(-LIMITS.aiLog) };
}

const references = (d: DossierData) => d.references.map((r) => r.apa);

/** Asks two to four questions about one section and stores them, replacing earlier ones. */
export async function askQuestions(
  user: User,
  d: DossierData,
  outcomeId: string,
  sectionId: string,
  locale: Locale,
  now = Date.now(),
): Promise<GuidedResult> {
  if (d.framework.confirmedAt === undefined) return { ok: false, error: "not-confirmed" };
  const message = buildQuestionsMessage(d, outcomeId, sectionId, locale);
  const blocked = await quotaGate(user);
  if (blocked) return { ok: false, error: blocked };

  // One retry: a malformed answer is rare, and the second call usually fixes it.
  for (let attempt = 0; attempt < 2; attempt++) {
    const answer = await callPortfolioModel(user, QUESTIONS_PROMPT_ID, message, locale, 800);
    if (!answer) break;
    const questions = parseQuestions(answer.text, references(d));
    if (questions) {
      const section = { questions, answers: [], at: now, model: answer.model };
      const data = withLog(
        {
          ...d,
          guided: { ...d.guided, [outcomeId]: { ...d.guided?.[outcomeId], [sectionId]: section } },
        },
        // Questions are coaching, not text: the disclosure names them with the feedback.
        { at: now, action: "review", outcomeId, model: answer.model },
      );
      return { ok: true, data };
    }
    log("portfolio-guided", { outcome: "rejected", step: "questions", attempt });
  }
  return { ok: false, error: "failed" };
}

/**
 * Drafts the text for one section from the teacher's answers and linked evidence, and appends
 * it to the chapter (`currentText` = what the teacher had in the textarea, so unsaved edits are
 * kept) under the section's title.
 */
export async function draftSection(
  user: User,
  d: DossierData,
  outcomeId: string,
  sectionId: string,
  currentText: string,
  locale: Locale,
  now = Date.now(),
): Promise<GuidedResult> {
  if (d.coachMode !== "draft") return { ok: false, error: "not-draft-mode" };
  if (d.framework.confirmedAt === undefined) return { ok: false, error: "not-confirmed" };
  const built = buildSectionDraftMessage(d, outcomeId, sectionId, currentText, locale);
  if (!built) return { ok: false, error: "no-material" };
  let message = built;
  const blocked = await quotaGate(user);
  if (blocked) return { ok: false, error: blocked };

  for (let attempt = 0; attempt < 2; attempt++) {
    const answer = await callPortfolioModel(user, DRAFT_PROMPT_ID, message, locale, 1_500);
    if (!answer) break;
    const checked = checkSectionDraft(answer.text, references(d));
    if (checked.ok) {
      const paragraph = checked.text;
      const outcome = d.framework.outcomes.find((o) => o.id === outcomeId);
      const section = outcome && writingSections(outcome).find((s) => s.id === sectionId);
      if (!section) break;
      const text = appendSection(currentText, section, paragraph);
      return {
        ok: true,
        data: withLog(writeChapter(d, outcomeId, text, { aiDrafted: true }), {
          at: now,
          action: "draft",
          outcomeId,
          model: answer.model,
        }),
      };
    }
    log("portfolio-guided", { outcome: "rejected", step: "draft", attempt });
    message = retryDraftMessage(message, checked.unknown, locale);
  }
  return { ok: false, error: "failed" };
}

const SectionId = z.string().min(1).max(LIMITS.id);
const AnswerList = z.array(z.string().max(GUIDED_LIMITS.answer)).max(GUIDED_LIMITS.questions);

/** The answers typed beside the chapter: `answer:<sectionId>`, one field per question. */
export function answersFromForm(fd: FormData): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const key of new Set(fd.keys())) {
    if (!key.startsWith("answer:")) continue;
    const id = SectionId.safeParse(key.slice("answer:".length));
    const list = AnswerList.safeParse(fd.getAll(key).filter((v) => typeof v === "string"));
    if (id.success && list.success) out[id.data] = list.data;
  }
  return out;
}

export type GuidedIntent = "guideQuestions" | "guideDraft";

/**
 * One guided-writing button (`guideQuestions:<sectionId>` or `guideDraft:<sectionId>`). The
 * chapter text and the answers typed beside it are kept first, so nothing typed is lost.
 */
export async function runGuidedIntent(
  user: User,
  d: DossierData,
  intent: GuidedIntent,
  outcomeId: string,
  sectionId: string,
  fd: FormData,
  locale: Locale,
): Promise<GuidedResult | { ok: false; error: "not-found" }> {
  const outcome = d.framework.outcomes.find((o) => o.id === outcomeId);
  if (!outcome || !writingSections(outcome).some((s) => s.id === sectionId))
    return { ok: false, error: "not-found" };
  const text = String(fd.get("text") ?? "").slice(0, LIMITS.documentText);
  const typed = withAnswers(d, outcomeId, answersFromForm(fd));
  if (intent === "guideDraft") return draftSection(user, typed, outcomeId, sectionId, text, locale);
  // Asking keeps what the teacher typed in the chapter, as saving would.
  return askQuestions(user, writeChapter(typed, outcomeId, text), outcomeId, sectionId, locale);
}
