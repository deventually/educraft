/**
 * How many optional "Meer details" fields of a profile are filled in. Shown in the
 * editor's disclosure summary so details that are folded away are never forgotten.
 * Pure (no React). The national level is not counted: the onderwijstype always
 * fills it in, so it says nothing about what the teacher added.
 */
import type { ContextProfile, PackFieldValue } from "./types";

const filledText = (v: string | undefined): boolean => (v ?? "").trim().length > 0;

function filledPackValue(v: PackFieldValue): boolean {
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "number") return Number.isFinite(v);
  return filledText(v);
}

export function countFilledDetails(profile: ContextProfile): number {
  let n = 0;
  if (filledText(profile.domain)) n++;
  for (const v of [
    profile.professionalContext,
    profile.tools,
    profile.pedagogy,
    profile.learnerNounOverride,
  ]) {
    if (filledText(v)) n++;
  }
  for (const v of Object.values(profile.packValues ?? {})) {
    if (filledPackValue(v)) n++;
  }
  for (const f of profile.customFields ?? []) {
    if (filledText(f.label) || filledText(f.value)) n++;
  }
  return n;
}
