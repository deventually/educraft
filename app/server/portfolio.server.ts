/**
 * Route glue for the BDB/BKE workplace (brief P25, 25.3): the role gate, the
 * owner-scoped dossier load (a foreign or unknown dossier is a 404) and one
 * save path for every `<Form intent>`. Routes stay thin.
 */
import { requireRole } from "./auth.server";
import { runAiCall } from "./aiCalls.server";
import { portfolioAccess } from "./portfolioAccess.server";
import { getDossier, updateDossier, type Dossier } from "./repositories/portfolio.server";
import type { User } from "./auth.server";
import { applyIntent } from "~/lib/portfolio/intents";
import { LIMITS } from "~/lib/portfolio/schema";
import { proofreadOutcome, reviewDossier, reviewOutcome } from "./portfolioCoach.server";
import { extractFramework } from "./portfolioExtract.server";
import { answersFromForm, type GuidedIntent, runGuidedIntent } from "./portfolioGuided.server";
import { withAnswers } from "~/lib/portfolio/guided";
import { getMessages } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import { getAvailableTools } from "./availability.server";
import { loc } from "~/lib/i18n/localized";
import type { DossierData } from "~/lib/portfolio/types";
import { suggestEvidence } from "~/lib/portfolio/suggest";
import { listGenerations } from "./repositories/generations.server";
import { addGenerationToDossier } from "./evidence.server";
import { refreshCourseEvidence } from "./courseEvidence.server";
import { saveAnchors } from "./dossierAnchors.server";
import { runBatchIntent } from "./portfolioBatch.server";
import type { SortProposal } from "~/lib/portfolio/batch";
import { loadCourseLinks } from "./courses.server";
import { getToolBySlug } from "~/lib/registry";
import { resolveModelInfo } from "~/lib/ai/models";

/** A teacher or admin for whom the workplace is switched on; anyone else gets a 404. */
export async function requirePortfolioUser(request: Request): Promise<User> {
  const user = await requireRole(request, "teacher", "admin");
  if (!(await portfolioAccess(user))) throw new Response("Not Found", { status: 404 });
  return user;
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

/** Slug → display name of every tool this user may open, in the request's locale. */
export async function availableToolNames(
  request: Request,
  user: User,
): Promise<Map<string, string>> {
  const locale = getLocale(request);
  const tools = await getAvailableTools(user);
  return new Map(tools.map((t) => [t.slug, loc(t.name, locale)]));
}

/** A tool's display name for a generation, falling back to its slug. */
function toolName(slug: string, locale: ReturnType<typeof getLocale>): string {
  const name = getToolBySlug(slug)?.name;
  return name ? loc(name, locale) : slug;
}

/** A model's display name; a model that left the catalog keeps its id as its name. */
export function modelDisplayName(id: string): string {
  try {
    return resolveModelInfo(id).displayName;
  } catch {
    return id;
  }
}

/**
 * "Beoordeel het hele dossier": the latest coach review per outcome, counted
 * per verdict, in framework order. Outcomes never reviewed are left out.
 */
export function dossierReviewOverview(d: DossierData) {
  return d.framework.outcomes.flatMap((o) => {
    const stored = d.reviews?.[o.id];
    if (!stored) return [];
    const count = (v: string) => stored.review.criteria.filter((c) => c.verdict === v).length;
    return [
      {
        outcomeId: o.id,
        at: stored.at,
        modelName: modelDisplayName(stored.model),
        ...(stored.provisional ? { provisional: true as const } : {}),
        shown: count("shown"),
        partial: count("partial"),
        missing: count("missing"),
        overall: stored.review.overall,
      },
    ];
  });
}

/** How many recent generations "Dit heb je misschien al" looks at. */
const SUGGEST_FROM = 200;

/**
 * "Dit heb je misschien al" (27.2): the teacher's own earlier work that fits a
 * criterion, per criterion id, with the tool's name for display.
 */
export async function loadSuggestions(request: Request, user: User, d: DossierData) {
  const locale = getLocale(request);
  const [gens, links] = await Promise.all([
    listGenerations(user.id, SUGGEST_FROM),
    loadCourseLinks(user.id),
  ]);
  const byCriterion = suggestEvidence(d, gens, links.byGeneration);
  return Object.fromEntries(
    Object.entries(byCriterion).map(([id, list]) => [
      id,
      list.map((s) => ({ ...s, toolName: toolName(s.toolSlug, locale) })),
    ]),
  );
}

export type PortfolioActionResult =
  | {
      ok: true;
      intent: string;
      flagged?: number;
      clipped?: boolean;
      /** proofread: how many proposals came back. */
      proposals?: number;
      /** anchors: course parts taken into the dossier as evidence; addEvidenceBatch: items added. */
      added?: number;
      /** proposeEvidence: a proposal per file, for the teacher to confirm. */
      sorted?: SortProposal[];
      /** reviewAll: chapters reviewed, and chapters whose review failed. */
      reviewed?: number;
      /** guideDraftAll: sections written; with guideQuestionsAll, `failed` counts sections. */
      drafted?: number;
      failed?: number;
    }
  | { ok: false; error: string };

/**
 * Applies the posted intent to the dossier and stores it. Nine intents call a
 * model (`extract` on the framework page; `review`, `guideQuestions:<sectionId>`,
 * `guideDraft:<sectionId>`, `guideQuestionsAll`, `guideDraftAll` and
 * `proofread` for one chapter; `reviewAll` for the whole dossier; `proposeEvidence`
 * for evidence in one go, which stores nothing); every other one is a pure edit.
 */
export async function saveIntent(
  request: Request,
  id: string | undefined,
): Promise<PortfolioActionResult> {
  const { user, dossier } = await loadDossier(request, id);
  const fd = await request.formData();
  // The page's call id: leaving the page with "Stop" stops this action's model calls.
  return runAiCall(user.id, fd.get("aiCall"), () => runIntent(request, user, dossier, fd));
}

async function runIntent(
  request: Request,
  user: User,
  dossier: Dossier,
  fd: FormData,
): Promise<PortfolioActionResult> {
  const locale = getLocale(request);
  const m = getMessages(locale);
  const intent = String(fd.get("intent") ?? "");

  if (intent === "extract") {
    const formText = String(fd.get("formText") ?? "").slice(0, LIMITS.documentText);
    const result = await extractFramework(user, dossier.data, formText, locale).catch(() => ({
      ok: false as const,
      error: "failed" as const,
    }));
    if (!result.ok) return { ok: false, error: m.portfolio.framework.extractErrors[result.error] };
    const saved = await updateDossier(user.id, dossier.id, { data: result.data }).catch(() => null);
    if (!saved) return { ok: false, error: m.portfolio.errorInvalid };
    return { ok: true, intent, flagged: result.flagged, clipped: result.clipped };
  }

  if (intent === "review") {
    const outcomeId = String(fd.get("outcomeId") ?? "");
    const outcome = dossier.data.framework.outcomes.find((o) => o.id === outcomeId);
    if (!outcome) return { ok: false, error: m.portfolio.errorNotFound };
    const result = await reviewOutcome(user, dossier.data, outcomeId, locale).catch(() => ({
      ok: false as const,
      error: "failed" as const,
    }));
    if (!result.ok) return { ok: false, error: m.portfolio.coach.errors[result.error] };
    const saved = await updateDossier(user.id, dossier.id, { data: result.data }).catch(() => null);
    if (!saved) return { ok: false, error: m.portfolio.errorInvalid };
    return { ok: true, intent };
  }

  // One section (`guideDraft:<sectionId>`) or the whole chapter (`guideDraftAll`).
  const guided = /^(guideQuestions|guideDraft)(?:All$|:(.+)$)/.exec(intent);
  if (guided) {
    const step = (guided[2] === undefined ? `${guided[1]}All` : guided[1]) as GuidedIntent;
    const outcomeId = String(fd.get("outcomeId") ?? "");
    const result = await runGuidedIntent(
      user,
      dossier.data,
      step,
      outcomeId,
      guided[2] ?? "",
      fd,
      locale,
    ).catch(() => ({ ok: false as const, error: "failed" as const }));
    if (!result.ok)
      return {
        ok: false,
        error:
          result.error === "not-found"
            ? m.portfolio.errorNotFound
            : m.portfolioGuided.errors[result.error],
      };
    const saved = await updateDossier(user.id, dossier.id, { data: result.data }).catch(() => null);
    if (!saved) return { ok: false, error: m.portfolio.errorInvalid };
    return { ok: true, intent: step, drafted: result.drafted, failed: result.failed };
  }

  if (intent === "proofread") {
    const outcomeId = String(fd.get("outcomeId") ?? "");
    if (!dossier.data.framework.outcomes.some((o) => o.id === outcomeId))
      return { ok: false, error: m.portfolio.errorNotFound };
    const result = await proofreadOutcome(user, dossier.data, outcomeId, locale).catch(() => ({
      ok: false as const,
      error: "failed" as const,
    }));
    if (!result.ok)
      return {
        ok: false,
        error:
          result.error === "failed"
            ? m.portfolio.proofread.failed
            : m.portfolio.coach.errors[result.error],
      };
    const saved = await updateDossier(user.id, dossier.id, { data: result.data }).catch(() => null);
    if (!saved) return { ok: false, error: m.portfolio.errorInvalid };
    return { ok: true, intent, proposals: result.suggestions.length };
  }

  if (intent === "reviewAll") {
    const result = await reviewDossier(user, dossier.data, locale).catch(() => ({
      ok: false as const,
      error: "failed" as const,
    }));
    if (!result.ok)
      return {
        ok: false,
        error:
          result.error === "empty-chapter"
            ? m.portfolio.dossierReview.noChapters
            : m.portfolio.coach.errors[result.error],
      };
    const saved = await updateDossier(user.id, dossier.id, { data: result.data }).catch(() => null);
    if (!saved) return { ok: false, error: m.portfolio.errorInvalid };
    return { ok: true, intent, reviewed: result.reviewed.length, failed: result.failed.length };
  }

  if (intent === "adoptSuggestions") {
    // One path with "Gebruik als bewijs" (P27.1): owner-checked, never a duplicate.
    const criterionId = String(fd.get("criterionId") ?? "");
    const ids = [...new Set(fd.getAll("generationIds").map(String))].slice(0, 20);
    if (ids.length === 0) return { ok: false, error: m.portfolio.errorNotFound };
    for (const generationId of ids) {
      const added = await addGenerationToDossier(
        user,
        { generationId, dossierId: dossier.id, criterionId },
        locale,
      );
      if (!added.ok) return added;
    }
    return { ok: true, intent };
  }

  // Evidence in one go: a proposal per file (model calls), then what the teacher ticked.
  const batch = await runBatchIntent(user, dossier, intent, fd, locale);
  if (batch) return batch;

  // Start wizard: the anchors check the courses, so they are not a pure edit.
  if (intent === "anchors") return saveAnchors(user, dossier, fd, locale);

  if (intent === "refreshCourseEvidence") {
    const refreshed = await refreshCourseEvidence(
      user.id,
      dossier.data,
      String(fd.get("evidenceId") ?? ""),
      locale,
    );
    if (!refreshed.ok) return refreshed;
    await updateDossier(user.id, dossier.id, { data: refreshed.data });
    return { ok: true, intent };
  }

  const result = applyIntent(dossier.data, fd, { now: Date.now(), locale });
  if (!result.ok) {
    return {
      ok: false,
      error: result.error === "not-found" ? m.portfolio.errorNotFound : m.portfolio.errorInvalid,
    };
  }
  // Saving the chapter also keeps the answers typed beside it (guided writing).
  const data =
    intent === "writeChapter"
      ? withAnswers(result.data, String(fd.get("outcomeId") ?? ""), answersFromForm(fd))
      : result.data;
  await updateDossier(user.id, dossier.id, { data });
  return { ok: true, intent };
}
