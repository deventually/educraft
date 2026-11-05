/**
 * The dossier route in five steps (brief P27, 27.2). Derived from what the
 * dossier already holds, never stored: framework → collect earlier work →
 * fill the gaps with a tool → write the chapters → finish (mark shown, AI
 * disclosure, export, practise the final interview).
 */
import { nextStep } from "./progress";
import type { DossierData } from "./types";

export const DOSSIER_STEPS = ["framework", "collect", "fill", "write", "finish"] as const;
export type DossierStep = (typeof DOSSIER_STEPS)[number];

export function dossierStep(d: DossierData): DossierStep {
  switch (nextStep(d).step) {
    case "build-framework":
    case "confirm-framework":
      return "framework";
    case "add-evidence":
      return d.evidence.length === 0 ? "collect" : "fill";
    case "write-chapter":
      return "write";
    default:
      return "finish";
  }
}
