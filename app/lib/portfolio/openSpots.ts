/**
 * Open spots: places in a dossier that are not finished yet. A drafted paragraph
 * leaves `[aanvullen: …]` / `[to add: …]` where evidence is missing, a teacher
 * may type `[invullen]` or TODO, a chapter can be empty and evidence can still be
 * to come (a title without text). They may stay while the teacher works, but
 * never in the handed-in version: the final Word export refuses while one is
 * left (BESLUIT-2026-11-07-4). Pure, no LLM.
 *
 * When in doubt, no finding: "[…]" in a quote, "[1]" or "[zie bijlage 2]" are
 * ordinary academic text, not an open spot.
 */
import type { DossierData } from "./types";

/**
 * `[aanvullen…]`, `[to add…]`, `[invullen…]`, `[fill in…]` in any case, and the
 * all-caps words TODO and XXX. Global: use with `matchAll` / `split`.
 */
export const OPEN_SPOT =
  /\[\s*(?:aanvullen|invullen|to add|fill in|todo)\b[^\][\n]{0,300}\]|\bTODO\b|\bXXX\b/giu;

const isMarker = (m: string) => m.startsWith("[") || m === m.toUpperCase();

/** A text cut into pieces, each a marker or not; joined they give the text back. */
export function splitOnMarkers(text: string): { text: string; marker: boolean }[] {
  const parts: { text: string; marker: boolean }[] = [];
  let at = 0;
  // Case-insensitive for the brackets, but TODO and XXX only as capitals.
  for (const m of text.matchAll(OPEN_SPOT)) {
    if (!isMarker(m[0])) continue;
    if (m.index > at) parts.push({ text: text.slice(at, m.index), marker: false });
    parts.push({ text: m[0], marker: true });
    at = m.index + m[0].length;
  }
  if (at < text.length) parts.push({ text: text.slice(at), marker: false });
  return parts;
}

/** Every marker in a text, in order, each occurrence. */
export function markersIn(text: string): string[] {
  return splitOnMarkers(text)
    .filter((p) => p.marker)
    .map((p) => p.text);
}

export type OpenSpot =
  | { kind: "marker" | "empty"; where: "chapter"; outcomeId: string; text: string }
  | { kind: "marker" | "empty"; where: "evidence"; evidenceId: string; text: string };

/**
 * Every open spot the export would carry, in export order: per outcome its
 * chapter (a marker, or empty), then per evidence item (a marker, or no text;
 * `text` is then its title).
 */
export function openSpots(d: DossierData): OpenSpot[] {
  const spots: OpenSpot[] = [];
  for (const o of d.framework.outcomes) {
    const text = d.chapters.find((ch) => ch.outcomeId === o.id)?.text ?? "";
    if (!text.trim()) spots.push({ kind: "empty", where: "chapter", outcomeId: o.id, text: "" });
    for (const m of markersIn(text))
      spots.push({ kind: "marker", where: "chapter", outcomeId: o.id, text: m });
  }
  for (const e of d.evidence) {
    if (!e.text.trim())
      spots.push({ kind: "empty", where: "evidence", evidenceId: e.id, text: e.title });
    for (const m of markersIn(`${e.title}\n${e.text}`))
      spots.push({ kind: "marker", where: "evidence", evidenceId: e.id, text: m });
  }
  return spots;
}

/** The outcome whose page shows this evidence: of its first linked criterion, else the first. */
export function evidenceOutcome(d: DossierData, evidenceId: string): string | undefined {
  const e = d.evidence.find((x) => x.id === evidenceId);
  const first = e?.criterionIds[0];
  const owner = d.framework.outcomes.find((o) => o.criteria.some((c) => c.id === first));
  return (owner ?? d.framework.outcomes[0])?.id;
}
