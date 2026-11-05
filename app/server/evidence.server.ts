/**
 * Saved work as evidence in a BDB/BKE dossier (P25 "Mijn werk", P27.1 under the result).
 * One path for every caller: both the dossier and the generation must be the caller's,
 * a named criterion must exist in the dossier, and the same work is never added twice
 * (a second add only links the extra criterion to the evidence already there). The
 * workplace must be switched on for the caller (P27.2).
 */
import { portfolioAccess } from "./portfolioAccess.server";
import { getGeneration } from "./repositories/generations.server";
import { getDossier, updateDossier } from "./repositories/portfolio.server";
import { addEvidence, updateEvidence } from "~/lib/portfolio/edit";
import { DossierDataSchema, LIMITS } from "~/lib/portfolio/schema";
import { getToolBySlug } from "~/lib/registry";
import { getMessages, type Locale } from "~/lib/i18n";
import { loc } from "~/lib/i18n/localized";

export interface AddToDossierInput {
  generationId: string;
  dossierId: string;
  /** Optional: link the evidence to this criterion straight away. */
  criterionId?: string | null;
}

export type AddToDossierResult = { ok: true } | { ok: false; error: string };

export async function addGenerationToDossier(
  user: { id: string; role: string },
  input: AddToDossierInput,
  locale: Locale,
): Promise<AddToDossierResult> {
  const m = getMessages(locale).portfolio;
  // The workplace switched off (P27): as if the dossier did not exist.
  if (!(await portfolioAccess(user))) return { ok: false, error: m.errorNotFound };
  const userId = user.id;
  const [generation, dossier] = await Promise.all([
    getGeneration(userId, input.generationId),
    getDossier(userId, input.dossierId),
  ]);
  if (!generation || !dossier) return { ok: false, error: m.errorNotFound };

  const criterionId = input.criterionId || null;
  const criteria = dossier.data.framework.outcomes.flatMap((o) => o.criteria.map((c) => c.id));
  if (criterionId && !criteria.includes(criterionId)) return { ok: false, error: m.errorNotFound };

  const existing = dossier.data.evidence.find((e) => e.sourceGenerationId === generation.id);
  let next = dossier.data;
  if (existing) {
    if (criterionId && !existing.criterionIds.includes(criterionId))
      next = updateEvidence(dossier.data, existing.id, {
        criterionIds: [...existing.criterionIds, criterionId],
      });
  } else {
    const toolName = getToolBySlug(generation.toolSlug)?.name;
    next = addEvidence(dossier.data, {
      title: (toolName ? loc(toolName, locale) : generation.toolSlug).slice(0, LIMITS.title),
      kind: "other",
      text: generation.outputMarkdown.slice(0, LIMITS.documentText),
      criterionIds: criterionId ? [criterionId] : [],
      sourceGenerationId: generation.id,
    });
  }
  if (!DossierDataSchema.safeParse(next).success) return { ok: false, error: m.errorInvalid };
  if (next !== dossier.data) await updateDossier(userId, dossier.id, { data: next });
  return { ok: true };
}
