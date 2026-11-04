/**
 * The portfolio coach, the server half (brief P25, 25.5): gates, the model
 * call, the checks from `coach.ts`, usage accounting and the `aiLog` line.
 * Returns the next dossier data; the caller stores it. Never sets a status.
 */
import {
  buildCoachMessage,
  buildDraftMessage,
  parseCoachReview,
  parseDraft,
} from "~/lib/portfolio/coach";
import { LIMITS } from "~/lib/portfolio/schema";
import type { AiLogEntry, CoachReview, DossierData } from "~/lib/portfolio/types";
import type { Locale } from "~/lib/i18n";
import type { User } from "./auth.server";
import { callPortfolioModel, quotaGate } from "./portfolioAi.server";
import { log } from "./log.server";

export type CoachError =
  | "not-confirmed"
  | "empty-chapter"
  | "no-evidence"
  | "not-draft-mode"
  | "quota"
  | "failed";

export type CoachResult<T> =
  | ({ ok: true; data: DossierData } & T)
  | { ok: false; error: CoachError };

function chapterOf(d: DossierData, outcomeId: string): string {
  return d.chapters.find((ch) => ch.outcomeId === outcomeId)?.text ?? "";
}

function withLog(d: DossierData, entry: AiLogEntry): DossierData {
  return { ...d, aiLog: [...d.aiLog, entry].slice(-LIMITS.aiLog) };
}

/** Reviews one outcome's chapter against its confirmed criteria. */
export async function reviewOutcome(
  user: User,
  d: DossierData,
  outcomeId: string,
  locale: Locale,
  now = Date.now(),
): Promise<CoachResult<{ review: CoachReview; model: string }>> {
  if (d.framework.confirmedAt === undefined) return { ok: false, error: "not-confirmed" };
  if (!chapterOf(d, outcomeId).trim()) return { ok: false, error: "empty-chapter" };
  const blocked = await quotaGate(user);
  if (blocked) return { ok: false, error: blocked };

  const message = buildCoachMessage(d, outcomeId, locale);
  // One retry: a malformed answer is rare, and the second call usually fixes it.
  for (let attempt = 0; attempt < 2; attempt++) {
    const answer = await callPortfolioModel(user, "portfolio-coach@v1", message, locale, 4_000);
    if (!answer) break;
    const parsed = parseCoachReview(answer.text, d, outcomeId);
    if (parsed.ok) {
      const data = withLog(
        {
          ...d,
          reviews: {
            ...d.reviews,
            [outcomeId]: { at: now, model: answer.model, review: parsed.review },
          },
        },
        { at: now, action: "review", outcomeId, model: answer.model },
      );
      return { ok: true, data, review: parsed.review, model: answer.model };
    }
    log("portfolio-coach", { outcome: "rejected", reason: parsed.error, attempt });
  }
  return { ok: false, error: "failed" };
}

/**
 * Drafts one paragraph for one criterion from the teacher's linked evidence and
 * appends it to the chapter (`currentText` = what the teacher had in the
 * textarea, so unsaved edits are kept).
 */
export async function draftParagraph(
  user: User,
  d: DossierData,
  outcomeId: string,
  criterionId: string,
  currentText: string,
  locale: Locale,
  now = Date.now(),
): Promise<CoachResult<{ paragraph: string }>> {
  if (d.coachMode !== "draft") return { ok: false, error: "not-draft-mode" };
  if (d.framework.confirmedAt === undefined) return { ok: false, error: "not-confirmed" };
  // The model sees what the teacher has in the textarea now, saved or not.
  const withText: DossierData = {
    ...d,
    chapters: d.chapters.map((ch) =>
      ch.outcomeId === outcomeId ? { ...ch, text: currentText } : ch,
    ),
  };
  const message = buildDraftMessage(withText, outcomeId, criterionId, locale);
  if (!message) return { ok: false, error: "no-evidence" };
  const blocked = await quotaGate(user);
  if (blocked) return { ok: false, error: blocked };

  const answer = await callPortfolioModel(user, "portfolio-draft@v1", message, locale, 1_000);
  const paragraph = answer ? parseDraft(answer.text) : null;
  if (!answer || !paragraph) return { ok: false, error: "failed" };

  const base = currentText.trimEnd();
  const text = base ? `${base}\n\n${paragraph}` : paragraph;
  const existing = d.chapters.find((ch) => ch.outcomeId === outcomeId);
  const chapters = existing
    ? d.chapters.map((ch) => (ch.outcomeId === outcomeId ? { ...ch, text, aiDrafted: true } : ch))
    : [...d.chapters, { id: crypto.randomUUID(), outcomeId, text, aiDrafted: true }];
  const data = withLog(
    { ...d, chapters },
    { at: now, action: "draft", outcomeId, model: answer.model },
  );
  return { ok: true, data, paragraph };
}
