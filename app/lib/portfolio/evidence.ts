import type { EvidenceItem } from "./types";

/**
 * Evidence without text is "Volgt nog" (BDB/BKE plan, PR 3): the title is there, the text is
 * still to come (a video, an observation report, feedback). It never counts as evidence and
 * is never a source for the AI; the AI only hears that it is coming.
 */
export function evidencePending(e: Pick<EvidenceItem, "text">): boolean {
  return e.text.trim() === "";
}
