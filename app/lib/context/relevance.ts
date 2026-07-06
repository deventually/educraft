/**
 * Field-relevance rules (Phase 10) — pure, engine-neutral predicates that decide
 * which teaching-context fields make sense for a given sector/track. They drive
 * both the editor (self-hiding fields) and the server-side defense in
 * `parseForm.ts`, so the two never drift. No control-flow lives in the engine;
 * relevance is data about the Dutch education structure, verified in the brief:
 *
 * - **Programme ("Opleiding")** is meaningless for the whole `vo` sector — its
 *   structure is schooltype → profiel → vakken, not opleidingen.
 * - **Professional field ("Beroepspraktijk")** is a vocational concept: it fits
 *   vmbo (a beroepsgerichte leerweg), mbo, hbo and wo, but not the general
 *   havo/vwo tracks.
 * - **Course** is a subject-level term; in Dutch it is "Vak" everywhere, and in
 *   English it reads "Subject" for vo (a school subject) and "Course" elsewhere.
 */
import type { LocalizedText } from "~/lib/i18n/localized";

/** Programme applies to every sector except general/vocational secondary (vo). */
export function showsProgramme(sector: string | undefined): boolean {
  return sector !== "vo";
}

/** Professional field applies everywhere except the general havo/vwo tracks. */
export function showsProfessionalContext(
  sector: string | undefined,
  track: string | undefined,
): boolean {
  return !(sector === "vo" && (track === "havo" || track === "vwo"));
}

/** Sector-aware label for the Course/"Vak" field (Dutch is "Vak" throughout). */
export function courseLabel(sector: string | undefined): LocalizedText {
  return sector === "vo" ? { nl: "Vak", en: "Subject" } : { nl: "Vak", en: "Course" };
}

/**
 * Sector-aware label for the domain field: vo picks a **profiel**, every other
 * sector picks a **domein**. Drives both the editor field and the prompt
 * injection label (`format.ts`) so the two never diverge.
 */
export function domainFieldLabel(sector: string | undefined): LocalizedText {
  return sector === "vo" ? { nl: "Profiel", en: "Profile" } : { nl: "Domein", en: "Domain" };
}
