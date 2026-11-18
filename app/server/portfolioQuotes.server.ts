/**
 * Quotes from feedback per criterion, the server half: one model call per feedback item for a
 * proposal (stored nowhere; the page shows it for the candidate to choose), and storing what the
 * candidate chose. The call goes through the anonymiseerpoort in one round with the overview the
 * candidate saw (`withPrivacyRound`): nothing unseen leaves. Pure checks live in
 * `~/lib/portfolio/quotes`.
 */
import { z } from "zod";
import { getMessages, type Locale } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import {
  buildQuotesMessage,
  ChooseQuotesSchema,
  parseQuotesAnswer,
  QUOTES_PROMPT_ID,
  setFeedbackQuotes,
} from "~/lib/portfolio/quotes";
import { DossierDataSchema } from "~/lib/portfolio/schema";
import { FEEDBACK_ROLES, type FeedbackQuote } from "~/lib/portfolio/types";
import type { ReviewItem } from "~/lib/privacy/gate";
import { runAiCall } from "./aiCalls.server";
import type { User } from "./auth.server";
import { loadDossier } from "./portfolio.server";
import { callPortfolioModel, quotaGate } from "./portfolioAi.server";
import { withPrivacyRound } from "./privacyGate.server";
import { type Dossier, updateDossier } from "./repositories/portfolio.server";

const EVENT = "portfolio-quotes";

export type QuotesActionResult =
  | {
      ok: true;
      intent: "proposeQuotes";
      evidenceId: string;
      quotes: FeedbackQuote[];
      /** Quotes the code left out: not in the feedback word for word, or an unknown criterion. */
      dropped: number;
    }
  | { ok: true; intent: "chooseQuotes"; evidenceId: string; saved: number }
  /** `privacyReview`: the gate found words the candidate did not see; nothing went. */
  | { ok: false; error: string; intent?: "proposeQuotes"; privacyReview?: ReviewItem[] };

const ProposeSchema = z.object({
  evidenceId: z.string().min(1).max(100),
  role: z.enum(FEEDBACK_ROLES),
});

async function propose(
  user: User,
  dossier: Dossier,
  fd: FormData,
  locale: Locale,
): Promise<QuotesActionResult> {
  const m = getMessages(locale);
  const t = m.portfolioQuotes.errors;
  const input = ProposeSchema.safeParse(Object.fromEntries(fd));
  if (!input.success) return { ok: false, error: m.portfolio.errorInvalid };
  const d = dossier.data;
  const item = d.evidence.find((e) => e.id === input.data.evidenceId);
  if (item?.kind !== "feedback") return { ok: false, error: t.notFeedback };
  if (!item.text.trim()) return { ok: false, error: t.empty };
  if (d.framework.confirmedAt === undefined) return { ok: false, error: t.notConfirmed };
  if (await quotaGate(user)) return { ok: false, error: m.portfolioBatch.errors.quota };

  const message = buildQuotesMessage(d, item, input.data.role, locale);
  // One round with the overview the candidate saw: nothing unseen goes (anonymiseerpoort).
  const round = await withPrivacyRound(fd.get("privacy"), () =>
    callPortfolioModel(user, QUOTES_PROMPT_ID, message, locale, 1_500, EVENT),
  );
  if (round.review)
    return {
      ok: false,
      intent: "proposeQuotes",
      error: m.privacy.askTitle,
      privacyReview: round.review,
    };
  const parsed = parseQuotesAnswer(round.value?.text ?? null, d, item.text);
  if (!parsed) return { ok: false, error: t.failed };
  return { ok: true, intent: "proposeQuotes", evidenceId: item.id, ...parsed };
}

async function choose(
  user: User,
  dossier: Dossier,
  fd: FormData,
  locale: Locale,
): Promise<QuotesActionResult> {
  const m = getMessages(locale);
  const input = ChooseQuotesSchema.safeParse(Object.fromEntries(fd));
  if (!input.success) return { ok: false, error: m.portfolio.errorInvalid };
  const { evidenceId, giver, role, date, quotes } = input.data;
  let next: Dossier["data"];
  try {
    next = setFeedbackQuotes(dossier.data, evidenceId, {
      giver,
      role,
      ...(date ? { date } : {}),
      quotes,
    });
  } catch {
    return { ok: false, error: m.portfolioQuotes.errors.notInFeedback };
  }
  if (!DossierDataSchema.safeParse(next).success)
    return { ok: false, error: m.portfolio.errorInvalid };
  await updateDossier(user.id, dossier.id, { data: next });
  return { ok: true, intent: "chooseQuotes", evidenceId, saved: quotes.length };
}

/** The page's action: `proposeQuotes` (a model call) or `chooseQuotes`. */
export async function quotesAction(
  request: Request,
  id: string | undefined,
): Promise<QuotesActionResult> {
  const { user, dossier } = await loadDossier(request, id);
  const locale = getLocale(request);
  const fd = await request.formData();
  const intent = fd.get("intent");
  if (intent === "proposeQuotes")
    // The page's call id: leaving the page with "Stop" stops the model call.
    return runAiCall(user.id, fd.get("aiCall"), () => propose(user, dossier, fd, locale));
  if (intent === "chooseQuotes") return choose(user, dossier, fd, locale);
  return { ok: false, error: getMessages(locale).portfolio.errorInvalid };
}
