/**
 * "Grill me over het hele dossier", the pure half: every chapter's parts with what the teacher
 * was asked and answered, in the framework's order. It reads the same stored questions as
 * Grill me per chapter, so both show the same answers.
 */
import { outcomeLabel } from "./format";
import { type GuidedSectionView, guidedView } from "./guided";
import type { DossierData } from "./types";

export interface DossierGrillOutcome {
  outcomeId: string;
  label: string;
  sections: GuidedSectionView[];
}

/** Every outcome with parts to write; nothing before the framework is confirmed. */
export function dossierGrillView(d: DossierData): DossierGrillOutcome[] {
  if (d.framework.confirmedAt === undefined) return [];
  return d.framework.outcomes.flatMap((o) => {
    const sections = guidedView(d, o);
    return sections.length ? [{ outcomeId: o.id, label: outcomeLabel(o), sections }] : [];
  });
}
