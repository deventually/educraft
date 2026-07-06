/**
 * Sector seam (Phase 8) — the education sector a programme belongs to. Sector is
 * the axis that fixes the learner/teacher vocabulary and scopes the subject
 * taxonomy (`domains.ts`) and the track catalogue below. The engine never
 * branches on sector; it reads these data to build one injected directive
 * (`format.ts`), so capability grows by adding sectors/tracks, not `if`s.
 *
 * **po (basisonderwijs) is deliberately not shipped.** The canonical scope is
 * vo/mbo/hbo/wo, and the tool suite fits young learners poorly. The seam still
 * carries a per-sector `teacherNoun` so a future po pack (leerkracht, no NLQF
 * level, young-learner register) is a pure data addition, not an engine change.
 */
import type { LocalizedText } from "~/lib/i18n/localized";
import { loc } from "~/lib/i18n/localized";
import type { OutputLanguage } from "~/lib/registry/types";
import type { NlqfLevel } from "./nlqf";

export const SECTORS = ["vo", "mbo", "hbo", "wo"] as const;
export type Sector = (typeof SECTORS)[number];

export interface SectorInfo {
  /** Reads naturally inside the context intro, e.g. "voortgezet onderwijs (vo)". */
  label: LocalizedText;
  /** Default word for a learner in this sector. */
  learnerNoun: LocalizedText;
  /**
   * Interchangeable Dutch alternatives for the learner noun (mbo:
   * studenten↔deelnemers). Offered in the editor as an override; English makes no
   * such distinction, so overrides only affect Dutch output.
   */
  learnerNounAlternatives?: LocalizedText[];
  /** Word for the teacher — "docent" across the shipped sectors. */
  teacherNoun: LocalizedText;
}

const DOCENT: LocalizedText = { nl: "docent", en: "teacher" };
const STUDENTEN: LocalizedText = { nl: "studenten", en: "students" };

export const SECTORS_INFO: Record<Sector, SectorInfo> = {
  vo: {
    label: { nl: "voortgezet onderwijs (vo)", en: "secondary education (vo)" },
    learnerNoun: { nl: "leerlingen", en: "pupils" },
    teacherNoun: DOCENT,
  },
  mbo: {
    label: {
      nl: "middelbaar beroepsonderwijs (mbo)",
      en: "senior secondary vocational education (mbo)",
    },
    learnerNoun: STUDENTEN,
    learnerNounAlternatives: [{ nl: "deelnemers", en: "students" }],
    teacherNoun: DOCENT,
  },
  hbo: {
    label: { nl: "hoger beroepsonderwijs (hbo)", en: "higher professional education (hbo)" },
    learnerNoun: STUDENTEN,
    teacherNoun: DOCENT,
  },
  wo: {
    label: { nl: "wetenschappelijk onderwijs (wo)", en: "university education (wo)" },
    learnerNoun: STUDENTEN,
    teacherNoun: DOCENT,
  },
};

export interface TrackOption {
  /** Stable English-ish slug stored on the profile (see track field). */
  value: string;
  label: LocalizedText;
  /** The verified NLQF anchor prefilled when this track is chosen (overridable). */
  defaultNationalLevel?: NlqfLevel;
}

/**
 * The school-type / leerweg catalogue per sector, each carrying the verified
 * NLQF anchor (nlqf.nl / Staatscourant 2024-34565). Most meaningful for vo, where
 * the leerweg fixes the level; hbo/wo tracks mirror the degree cycle.
 */
export const TRACKS_BY_SECTOR: Record<Sector, TrackOption[]> = {
  vo: [
    {
      value: "vmbo-bb",
      label: { nl: "vmbo basisberoepsgerichte leerweg (bb)", en: "vmbo basic vocational (bb)" },
      defaultNationalLevel: "1",
    },
    {
      value: "vmbo-kb",
      label: {
        nl: "vmbo kaderberoepsgerichte leerweg (kb)",
        en: "vmbo middle-management vocational (kb)",
      },
      defaultNationalLevel: "2",
    },
    {
      value: "vmbo-gl",
      label: { nl: "vmbo gemengde leerweg (gl)", en: "vmbo combined (gl)" },
      defaultNationalLevel: "2",
    },
    {
      value: "vmbo-tl",
      label: { nl: "vmbo theoretische leerweg / mavo (tl)", en: "vmbo theoretical / mavo (tl)" },
      defaultNationalLevel: "2",
    },
    {
      value: "havo",
      label: { nl: "havo", en: "havo (senior general secondary)" },
      defaultNationalLevel: "4",
    },
    {
      value: "vwo",
      label: { nl: "vwo", en: "vwo (pre-university)" },
      defaultNationalLevel: "4+",
    },
  ],
  mbo: [
    {
      value: "entree",
      label: { nl: "mbo entree (niveau 1)", en: "mbo entry (level 1)" },
      defaultNationalLevel: "1",
    },
    {
      value: "mbo-2",
      label: { nl: "mbo-2 (basisberoepsopleiding)", en: "mbo-2 (basic vocational)" },
      defaultNationalLevel: "2",
    },
    {
      value: "mbo-3",
      label: { nl: "mbo-3 (vakopleiding)", en: "mbo-3 (professional)" },
      defaultNationalLevel: "3",
    },
    {
      value: "mbo-4",
      label: { nl: "mbo-4 (middenkader/specialist)", en: "mbo-4 (middle-management/specialist)" },
      defaultNationalLevel: "4",
    },
  ],
  hbo: [
    {
      value: "ad",
      label: { nl: "associate degree (ad)", en: "associate degree (ad)" },
      defaultNationalLevel: "5",
    },
    {
      value: "bachelor",
      label: { nl: "hbo-bachelor", en: "bachelor" },
      defaultNationalLevel: "6",
    },
    {
      value: "master",
      label: { nl: "hbo-master", en: "master" },
      defaultNationalLevel: "7",
    },
  ],
  wo: [
    {
      value: "bachelor",
      label: { nl: "wo-bachelor", en: "bachelor" },
      defaultNationalLevel: "6",
    },
    {
      value: "master",
      label: { nl: "wo-master", en: "master" },
      defaultNationalLevel: "7",
    },
    {
      value: "phd",
      label: { nl: "promotie (PhD)", en: "doctorate (PhD)" },
      defaultNationalLevel: "8",
    },
  ],
};

/** Runtime guard: is `s` a shipped sector? */
export function isSector(s: string): s is Sector {
  return (SECTORS as readonly string[]).includes(s);
}

/**
 * The two vo stages (Phase 11). onderbouw = the broad, foundational lower years
 * (no profiel yet); bovenbouw = the tweede fase where a profiel is chosen and the
 * work turns exam-oriented. EN labels keep the Dutch term parenthetically, in the
 * house style of the track labels (e.g. "havo (senior general secondary)").
 */
export const VO_PHASES = [
  { value: "onderbouw", label: { nl: "Onderbouw", en: "Lower secondary (onderbouw)" } },
  { value: "bovenbouw", label: { nl: "Bovenbouw", en: "Upper secondary (bovenbouw)" } },
] as const satisfies readonly { value: string; label: LocalizedText }[];

export type VoPhase = (typeof VO_PHASES)[number]["value"];

/** Runtime guard: is `v` one of the two vo stages? */
export function isVoPhase(v: string): v is VoPhase {
  return VO_PHASES.some((p) => p.value === v);
}

/** The tracks valid for a sector (empty for an unknown sector). */
export function tracksForSector(sector: string | undefined): TrackOption[] {
  return sector && isSector(sector) ? TRACKS_BY_SECTOR[sector] : [];
}

/** The default NLQF level a track prefills, or undefined. */
export function defaultLevelForTrack(
  sector: string | undefined,
  track: string | undefined,
): NlqfLevel | undefined {
  if (!track) return undefined;
  return tracksForSector(sector).find((t) => t.value === track)?.defaultNationalLevel;
}

/**
 * The Dutch learner-noun choices for a sector (default first). Drives the mbo
 * override control and its server-side validation; empty when there is no choice.
 */
export function learnerNounChoices(sector: string | undefined): string[] {
  if (!sector || !isSector(sector)) return [];
  const info = SECTORS_INFO[sector];
  if (!info.learnerNounAlternatives?.length) return [];
  return [loc(info.learnerNoun, "nl"), ...info.learnerNounAlternatives.map((a) => loc(a, "nl"))];
}

/**
 * The learner noun for a sector in the output language. An override (mbo
 * studenten↔deelnemers) is a Dutch-only distinction, so English always uses the
 * sector default.
 */
export function learnerNounFor(
  sector: Sector,
  override: string | undefined,
  lang: OutputLanguage,
): string {
  const info = SECTORS_INFO[sector];
  if (override && lang === "nl") return override;
  return loc(info.learnerNoun, lang);
}

/** The teacher noun for a sector in the output language. */
export function teacherNounFor(sector: Sector, lang: OutputLanguage): string {
  return loc(SECTORS_INFO[sector].teacherNoun, lang);
}
