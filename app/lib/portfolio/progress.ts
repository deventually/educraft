/**
 * Deterministic progress and checks for a dossier (no LLM). Advisory only:
 * nothing here changes the dossier.
 */
import type { DossierData, EvidenceKind } from "./types";

/** Words in a markdown text, ignoring markdown symbols. */
export function wordCount(markdown: string): number {
  const plain = markdown.replace(/[#*_>`~|[\]()!-]+(?=\s|$)/g, " ").replace(/^\s*[-*+]\s+/gm, " ");
  return plain.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** Keyword hints that tie a required-evidence line to an evidence kind. */
const KIND_HINTS: Record<EvidenceKind, RegExp> = {
  "lesson-plan": /les(voor|op|plan|ontwerp)|lesson|lesmateria/i,
  "observation-notes": /opname|video|film|observ|record/i,
  feedback: /feedback/i,
  "test-material": /toets|matrijs|antwoordmodel|rubric|test/i,
  analysis: /analyse|analysis/i,
  other: /$^/,
};

function covered(line: string, kinds: Set<EvidenceKind>): boolean {
  for (const kind of kinds) if (KIND_HINTS[kind].test(line)) return true;
  return false;
}

export interface OutcomeProgress {
  outcomeId: string;
  criteria: number;
  shown: number;
  /** Required-evidence lines with no linked evidence item of a matching kind. */
  missingEvidence: string[];
  words: number;
}

export function outcomeProgress(d: DossierData): OutcomeProgress[] {
  return d.framework.outcomes.map((o) => {
    const ids = new Set(o.criteria.map((c) => c.id));
    const kinds = new Set(
      d.evidence.filter((e) => e.criterionIds.some((id) => ids.has(id))).map((e) => e.kind),
    );
    const chapter = d.chapters.find((ch) => ch.outcomeId === o.id);
    return {
      outcomeId: o.id,
      criteria: o.criteria.length,
      shown: o.criteria.filter((c) => d.status[c.id] === "shown").length,
      missingEvidence: o.requiredEvidence.filter((line) => !covered(line, kinds)),
      words: chapter ? wordCount(chapter.text) : 0,
    };
  });
}

export type RequirementFinding =
  | { code: "criterion-without-evidence"; outcomeId: string; criterionId: string }
  | { code: "over-word-limit"; words: number; limit: number };

export function requirementFindings(d: DossierData): RequirementFinding[] {
  const findings: RequirementFinding[] = [];
  const linked = new Set(d.evidence.flatMap((e) => e.criterionIds));
  for (const o of d.framework.outcomes) {
    for (const c of o.criteria) {
      if (!linked.has(c.id))
        findings.push({ code: "criterion-without-evidence", outcomeId: o.id, criterionId: c.id });
    }
  }
  const limit = d.framework.requirements.maxWords;
  if (limit) {
    const words = d.chapters.reduce((n, ch) => n + wordCount(ch.text), 0);
    if (words > limit) findings.push({ code: "over-word-limit", words, limit });
  }
  return findings;
}

export type NextStep =
  | { step: "build-framework" }
  | { step: "confirm-framework" }
  | { step: "add-evidence"; outcomeId: string; criterionId: string }
  | { step: "write-chapter"; outcomeId: string }
  | { step: "mark-shown"; outcomeId: string; criterionId: string }
  | { step: "done" };

/** One recommended next step: framework → evidence → chapter → mark shown. */
export function nextStep(d: DossierData): NextStep {
  const outcomes = d.framework.outcomes;
  if (!outcomes.some((o) => o.criteria.length > 0)) return { step: "build-framework" };
  if (d.framework.confirmedAt === undefined) return { step: "confirm-framework" };

  const linked = new Set(d.evidence.flatMap((e) => e.criterionIds));
  for (const o of outcomes) {
    const c = o.criteria.find((x) => !linked.has(x.id));
    if (c) return { step: "add-evidence", outcomeId: o.id, criterionId: c.id };
  }
  for (const o of outcomes) {
    const chapter = d.chapters.find((ch) => ch.outcomeId === o.id);
    if (o.criteria.length > 0 && (!chapter || wordCount(chapter.text) === 0))
      return { step: "write-chapter", outcomeId: o.id };
  }
  for (const o of outcomes) {
    const c = o.criteria.find((x) => d.status[x.id] !== "shown");
    if (c) return { step: "mark-shown", outcomeId: o.id, criterionId: c.id };
  }
  return { step: "done" };
}
