/**
 * The required evidence of a learning outcome as a checklist (stap 3 of the guided route):
 * each line of the form with the items the teacher ticked for it, or else a guess from the
 * kind of evidence linked to the outcome. Pure and advisory, no AI.
 */
import type { DossierData, EvidenceItem, EvidenceKind } from "./types";

/** Keyword hints that tie a required-evidence line to an evidence kind. */
const KIND_HINTS: Record<EvidenceKind, RegExp> = {
  "lesson-plan": /les(voor|op|plan|ontwerp)|lesson|lesmateria/i,
  "observation-notes": /opname|video|film|observ|record/i,
  feedback: /feedback/i,
  "test-material": /toets|matrijs|antwoordmodel|rubric|test/i,
  analysis: /analyse|analysis/i,
  other: /$^/,
};

type ItemRef = Pick<EvidenceItem, "id" | "title">;

export interface RequirementState {
  line: string;
  /** Items the teacher ticked for this line. */
  linked: ItemRef[];
  /** Without a tick: an item of a matching kind, for the teacher to confirm. */
  guess?: ItemRef;
}

const ref = (e: EvidenceItem): ItemRef => ({ id: e.id, title: e.title });

/** A tool's output is never someone's feedback: an AI is not your mentor or colleague. */
const canGuess = (e: EvidenceItem, line: string) =>
  KIND_HINTS[e.kind].test(line) && !(e.kind === "feedback" && e.sourceGenerationId);

export function requirementChecklist(d: DossierData, outcomeId: string): RequirementState[] {
  const o = d.framework.outcomes.find((x) => x.id === outcomeId);
  if (!o) return [];
  const own = new Set(o.criteria.map((c) => c.id));
  const ofOutcome = d.evidence.filter((e) => e.criterionIds.some((id) => own.has(id)));
  return o.requiredEvidence.map((line) => {
    const linked = d.evidence
      .filter((e) => e.requirements?.some((r) => r.outcomeId === o.id && r.line === line))
      .map(ref);
    if (linked.length > 0) return { line, linked };
    const guess = ofOutcome.find((e) => canGuess(e, line));
    return { line, linked, ...(guess ? { guess: ref(guess) } : {}) };
  });
}

export const requirementMet = (r: RequirementState) => r.linked.length > 0 || r.guess !== undefined;
