/**
 * One learning outcome as its own dossier, for an institution that wants every
 * outcome handed in separately (LU1, LU2, …). Pure: the export, the open-spot
 * rule and the print page work on the part exactly as on the whole dossier.
 *
 * The part keeps the outcome, its chapter and status, the evidence linked to its
 * criteria (linked only to those), and the references its chapter mentions. A
 * reference that cannot be read stays in: a missing source is worse than an
 * extra one.
 */
import { referenceKey } from "./readiness";
import type { DossierData } from "./types";

export function dossierPart(d: DossierData, outcomeId: string): DossierData | null {
  const outcome = d.framework.outcomes.find((o) => o.id === outcomeId);
  if (!outcome) return null;
  const criteria = new Set(outcome.criteria.map((c) => c.id));
  const chapters = d.chapters.filter((ch) => ch.outcomeId === outcomeId);
  const text = chapters
    .map((ch) => ch.text)
    .join("\n")
    .toLowerCase();
  return {
    ...d,
    framework: { ...d.framework, outcomes: [outcome] },
    status: Object.fromEntries(Object.entries(d.status).filter(([id]) => criteria.has(id))),
    evidence: d.evidence
      .map((e) => ({ ...e, criterionIds: e.criterionIds.filter((id) => criteria.has(id)) }))
      .filter((e) => e.criterionIds.length > 0),
    chapters,
    references: d.references.filter((r) => {
      const key = referenceKey(r.apa);
      return !key || text.includes(key.surname.toLowerCase());
    }),
    // The AI disclosure of a part names only the AI use for this outcome.
    aiLog: d.aiLog.filter((l) => !l.outcomeId || l.outcomeId === outcomeId),
    reviews: d.reviews
      ? Object.fromEntries(Object.entries(d.reviews).filter(([id]) => id === outcomeId))
      : undefined,
  };
}
