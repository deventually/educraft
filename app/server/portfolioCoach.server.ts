/**
 * The portfolio coach, the server half (brief P25, 25.5): gates, the model
 * call, the checks from `coach.ts`, usage accounting and the `aiLog` line.
 * Returns the next dossier data; the caller stores it. Never sets a status.
 */
import { buildCoachMessage, parseCoachReview } from "~/lib/portfolio/coach";
import { buildProofreadMessage, parseProofread } from "~/lib/portfolio/proofread";
import { LIMITS } from "~/lib/portfolio/schema";
import type {
  AiLogEntry,
  CoachReview,
  DossierData,
  ProofreadSuggestion,
} from "~/lib/portfolio/types";
import type { Locale } from "~/lib/i18n";
import type { User } from "./auth.server";
import { callPortfolioModel, quotaGate } from "./portfolioAi.server";
import { log } from "./log.server";

export type CoachError = "not-confirmed" | "empty-chapter" | "quota" | "failed";

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
            [outcomeId]: {
              at: now,
              model: answer.model,
              ...(d.framework.provisional ? { provisional: true as const } : {}),
              review: parsed.review,
            },
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
 * Proofreads one outcome's chapter (language and form). Stores the checked
 * proposals; the chapter itself changes only when the teacher takes one over.
 * Needs no confirmed framework: proofreading uses no criteria.
 */
export async function proofreadOutcome(
  user: User,
  d: DossierData,
  outcomeId: string,
  locale: Locale,
  now = Date.now(),
): Promise<CoachResult<{ suggestions: ProofreadSuggestion[]; dropped: number }>> {
  if (!chapterOf(d, outcomeId).trim()) return { ok: false, error: "empty-chapter" };
  const blocked = await quotaGate(user);
  if (blocked) return { ok: false, error: blocked };

  const message = buildProofreadMessage(d, outcomeId, locale);
  for (let attempt = 0; attempt < 2; attempt++) {
    const answer = await callPortfolioModel(
      user,
      "portfolio-proofread@v1",
      message,
      locale,
      4_000,
      "portfolio-proofread",
    );
    if (!answer) break;
    const parsed = parseProofread(answer.text, d, outcomeId);
    if (parsed.ok) {
      if (parsed.dropped > 0) log("portfolio-proofread", { outcome: "dropped", n: parsed.dropped });
      const data = withLog(
        {
          ...d,
          proofreads: {
            ...d.proofreads,
            [outcomeId]: { at: now, model: answer.model, suggestions: parsed.suggestions },
          },
        },
        { at: now, action: "proofread", outcomeId, model: answer.model },
      );
      return { ok: true, data, suggestions: parsed.suggestions, dropped: parsed.dropped };
    }
    log("portfolio-proofread", { outcome: "rejected", reason: parsed.error, attempt });
  }
  return { ok: false, error: "failed" };
}

/**
 * "Beoordeel het hele dossier": the same coach over every chapter that has
 * text, in parallel. Reviews that worked are kept even when another failed.
 */
export async function reviewDossier(
  user: User,
  d: DossierData,
  locale: Locale,
  now = Date.now(),
): Promise<CoachResult<{ reviewed: string[]; failed: string[]; skipped: string[] }>> {
  if (d.framework.confirmedAt === undefined) return { ok: false, error: "not-confirmed" };
  const ids = d.framework.outcomes.map((o) => o.id);
  const withText = ids.filter((id) => chapterOf(d, id).trim());
  if (withText.length === 0) return { ok: false, error: "empty-chapter" };
  const blocked = await quotaGate(user);
  if (blocked) return { ok: false, error: blocked };

  const results = await Promise.all(
    withText.map((id) =>
      reviewOutcome(user, d, id, locale, now).catch(() => ({
        ok: false as const,
        error: "failed" as const,
      })),
    ),
  );
  const reviewed: string[] = [];
  const failed: string[] = [];
  let data = d;
  results.forEach((r, i) => {
    const id = withText[i];
    if (id === undefined) return;
    if (!r.ok) {
      failed.push(id);
      return;
    }
    reviewed.push(id);
    // Every result was built on the same `d`: take its stored review, with any provisional mark.
    const stored = r.data.reviews?.[id] ?? { at: now, model: r.model, review: r.review };
    data = withLog(
      { ...data, reviews: { ...data.reviews, [id]: stored } },
      { at: now, action: "review", outcomeId: id, model: r.model },
    );
  });
  if (reviewed.length === 0) return { ok: false, error: "failed" };
  return {
    ok: true,
    data,
    reviewed,
    failed,
    skipped: ids.filter((id) => !withText.includes(id)),
  };
}
