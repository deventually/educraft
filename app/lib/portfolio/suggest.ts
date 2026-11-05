/**
 * "Dit heb je misschien al" (brief P27, 27.2, route step 2): earlier work that
 * could be evidence for a criterion. Pure and advisory, no LLM: a generation
 * is suggested when its tool fits the criterion's own words (TOOL_HINTS), and
 * nothing is added until the teacher ticks it.
 */
import { addEvidence, updateEvidence } from "./edit";
import { criterionTools } from "./toolHints";
import type { DossierData } from "./types";

/** At most this many suggestions per criterion. */
export const MAX_SUGGESTIONS = 5;

export interface GenerationLike {
  id: string;
  toolSlug: string;
  createdAt: Date | number;
}

export interface EvidenceSuggestion {
  generationId: string;
  toolSlug: string;
  createdAt: number;
  /** Names of the courses this work is linked to (P20.4). */
  courses: string[];
}

const time = (d: Date | number) => (typeof d === "number" ? d : d.getTime());

/**
 * criterionId → suggestions, newest first. Criteria without a suggestion are
 * left out; work already evidence for that criterion is never suggested.
 */
export function suggestEvidence(
  d: DossierData,
  generations: readonly GenerationLike[],
  courseLinks: Record<string, readonly { courseName: string }[]> = {},
): Record<string, EvidenceSuggestion[]> {
  const newest = [...generations].sort((a, b) => time(b.createdAt) - time(a.createdAt));
  const out: Record<string, EvidenceSuggestion[]> = {};
  for (const o of d.framework.outcomes) {
    for (const c of o.criteria) {
      const tools = criterionTools(c);
      const already = new Set(
        d.evidence
          .filter((e) => e.sourceGenerationId && e.criterionIds.includes(c.id))
          .map((e) => e.sourceGenerationId),
      );
      const picks = newest
        .filter((g) => tools.has(g.toolSlug) && !already.has(g.id))
        .slice(0, MAX_SUGGESTIONS)
        .map((g) => ({
          generationId: g.id,
          toolSlug: g.toolSlug,
          createdAt: time(g.createdAt),
          courses: (courseLinks[g.id] ?? []).map((l) => l.courseName),
        }));
      if (picks.length > 0) out[c.id] = picks;
    }
  }
  return out;
}

export interface PickedGeneration {
  id: string;
  title: string;
  text: string;
}

/**
 * Puts the ticked generations at the criterion. A generation that is already
 * evidence in this dossier gets the criterion added; it is never copied twice.
 * Throws on an unknown criterion, like the other edits.
 */
export function adoptGenerations(
  d: DossierData,
  criterionId: string,
  picked: readonly PickedGeneration[],
): DossierData {
  let next = d;
  for (const g of picked) {
    const existing = next.evidence.find((e) => e.sourceGenerationId === g.id);
    next = existing
      ? updateEvidence(next, existing.id, {
          criterionIds: existing.criterionIds.includes(criterionId)
            ? existing.criterionIds
            : [...existing.criterionIds, criterionId],
        })
      : addEvidence(next, {
          title: g.title,
          kind: "other",
          text: g.text,
          criterionIds: [criterionId],
          sourceGenerationId: g.id,
        });
  }
  return next;
}
