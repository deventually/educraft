/**
 * Deterministic progress and checks for a dossier (no LLM). Advisory only:
 * nothing here changes the dossier.
 */
import { requirementChecklist, requirementMet } from "./requirements";
import type { DossierData } from "./types";

/** Words in a markdown text, ignoring markdown symbols. */
export function wordCount(markdown: string): number {
  const plain = markdown.replace(/[#*_>`~|[\]()!-]+(?=\s|$)/g, " ").replace(/^\s*[-*+]\s+/gm, " ");
  return plain.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export interface OutcomeProgress {
  outcomeId: string;
  criteria: number;
  shown: number;
  /** Required-evidence lines with no item ticked for them and none of a matching kind. */
  missingEvidence: string[];
  words: number;
}

export function outcomeProgress(d: DossierData): OutcomeProgress[] {
  return d.framework.outcomes.map((o) => {
    const chapter = d.chapters.find((ch) => ch.outcomeId === o.id);
    return {
      outcomeId: o.id,
      criteria: o.criteria.length,
      shown: o.criteria.filter((c) => d.status[c.id] === "shown").length,
      missingEvidence: requirementChecklist(d, o.id)
        .filter((r) => !requirementMet(r))
        .map((r) => r.line),
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
