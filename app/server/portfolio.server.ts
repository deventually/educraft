/**
 * Route glue for the BDB/BKE workplace (brief P25, 25.3): the role gate, the
 * owner-scoped dossier load (a foreign or unknown dossier is a 404) and one
 * save path for every `<Form intent>`. Routes stay thin.
 */
import { requireRole } from "./auth.server";
import { getDossier, updateDossier, type Dossier } from "./repositories/portfolio.server";
import type { User } from "./auth.server";
import { applyIntent } from "~/lib/portfolio/intents";
import { LIMITS } from "~/lib/portfolio/schema";
import { draftParagraph, reviewOutcome } from "./portfolioCoach.server";
import { getMessages } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";

export async function requirePortfolioUser(request: Request): Promise<User> {
  return requireRole(request, "teacher", "admin");
}

export async function loadDossier(
  request: Request,
  id: string | undefined,
): Promise<{ user: User; dossier: Dossier }> {
  const user = await requirePortfolioUser(request);
  const dossier = id ? await getDossier(user.id, id) : null;
  if (!dossier) throw new Response("Not Found", { status: 404 });
  return { user, dossier };
}

export type PortfolioActionResult = { ok: true; intent: string } | { ok: false; error: string };

/**
 * Applies the posted intent to the dossier and stores it. Two intents call the
 * coach (`review`, `draft:<criterionId>`); every other one is a pure edit.
 */
export async function saveIntent(
  request: Request,
  id: string | undefined,
): Promise<PortfolioActionResult> {
  const { user, dossier } = await loadDossier(request, id);
  const fd = await request.formData();
  const locale = getLocale(request);
  const m = getMessages(locale);
  const intent = String(fd.get("intent") ?? "");

  if (intent === "review" || intent.startsWith("draft:")) {
    const outcomeId = String(fd.get("outcomeId") ?? "");
    const outcome = dossier.data.framework.outcomes.find((o) => o.id === outcomeId);
    if (!outcome) return { ok: false, error: m.portfolio.errorNotFound };
    const result = await (intent === "review"
      ? reviewOutcome(user, dossier.data, outcomeId, locale)
      : draftParagraph(
          user,
          dossier.data,
          outcomeId,
          intent.slice("draft:".length),
          String(fd.get("text") ?? "").slice(0, LIMITS.documentText),
          locale,
        )
    ).catch(() => ({ ok: false as const, error: "failed" as const }));
    if (!result.ok) return { ok: false, error: m.portfolio.coach.errors[result.error] };
    const saved = await updateDossier(user.id, dossier.id, { data: result.data }).catch(() => null);
    if (!saved) return { ok: false, error: m.portfolio.errorInvalid };
    return { ok: true, intent: intent === "review" ? "review" : "draft" };
  }

  const result = applyIntent(dossier.data, fd, { now: Date.now(), locale });
  if (!result.ok) {
    return {
      ok: false,
      error: result.error === "not-found" ? m.portfolio.errorNotFound : m.portfolio.errorInvalid,
    };
  }
  await updateDossier(user.id, dossier.id, { data: result.data });
  return { ok: true, intent };
}
