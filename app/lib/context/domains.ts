/**
 * Type-scoped subject/domain catalogue (Phase 8, track-scoped in Phase 10) — the
 * options the domain picker offers per country → sector → track. This is a
 * *picker*, not a framework: a domain here may or may not resolve a verified pack
 * (`frameworks.ts`). hbo reuses the existing `HBO_DOMAINS` at the sector level; vo
 * is scoped by track to the correct profielen; mbo/wo have no catalogue yet (→
 * custom fields). Nothing is invented as a framework here.
 *
 * Verified against the brief's sourced facts:
 *  - **havo & vwo** share the four profielen chosen in the tweede fase — Natuur &
 *    Techniek, Natuur & Gezondheid, Economie & Maatschappij, Cultuur &
 *    Maatschappij (Rijksoverheid; SLO `sectoren/havo-vwo/profielen/`).
 *  - **vmbo bb/kb/gl** → the ten beroepsgerichte profielen (Besluit profielen
 *    vmbo 22-04-2016; SLO `sectoren/vmbo/beroepsgericht/`).
 *  - **vmbo-tl / mavo** → the four sectoren (Techniek, Zorg & Welzijn, Economie,
 *    Landbouw/Groen).
 * The specific school subject belongs in the Course/"Vak" field, so kernvakken
 * are deliberately NOT part of this catalogue.
 */
import type { LocalizedText } from "~/lib/i18n/localized";
import type { CountryCode } from "./countries";
import { isCountryCode } from "./countries";
import type { Sector } from "./sectors";
import { isSector } from "./sectors";
import { HBO_DOMAINS } from "./types";

export interface DomainOption {
  /** Stored on the profile as `domain`; validated against this catalogue. */
  value: string;
  label: LocalizedText;
}

/** hbo keeps its established Dutch domain strings (packs.ts keys on them). */
const HBO_DOMAIN_OPTIONS: DomainOption[] = HBO_DOMAINS.map((d) => ({ value: d, label: d }));

/** havo & vwo tweede-fase profielen (identical set for both). */
const HAVO_VWO_PROFIELEN: DomainOption[] = [
  { value: "nt", label: { nl: "Natuur & Techniek", en: "Nature & Technology" } },
  { value: "ng", label: { nl: "Natuur & Gezondheid", en: "Nature & Health" } },
  { value: "em", label: { nl: "Economie & Maatschappij", en: "Economics & Society" } },
  { value: "cm", label: { nl: "Cultuur & Maatschappij", en: "Culture & Society" } },
];

/** The ten vmbo beroepsgerichte profielen (bb/kb/gl) — verified SLO slugs. */
const VMBO_PROFIELEN: DomainOption[] = [
  {
    value: "bwi",
    label: { nl: "Bouwen, wonen en interieur (BWI)", en: "Building, housing & interior (BWI)" },
  },
  {
    value: "pie",
    label: {
      nl: "Produceren, installeren en energie (PIE)",
      en: "Production, installation & energy (PIE)",
    },
  },
  { value: "mt", label: { nl: "Mobiliteit en transport (M&T)", en: "Mobility & transport (M&T)" } },
  {
    value: "mvi",
    label: { nl: "Media, vormgeving en ICT (MVI)", en: "Media, design & ICT (MVI)" },
  },
  { value: "mat", label: { nl: "Maritiem en techniek (MaT)", en: "Maritime & technology (MaT)" } },
  { value: "zw", label: { nl: "Zorg en welzijn (Z&W)", en: "Care & welfare (Z&W)" } },
  {
    value: "eo",
    label: { nl: "Economie en ondernemen (E&O)", en: "Economics & entrepreneurship (E&O)" },
  },
  {
    value: "hbr",
    label: {
      nl: "Horeca, bakkerij en recreatie (HBR)",
      en: "Hospitality, bakery & recreation (HBR)",
    },
  },
  { value: "groen", label: { nl: "Groen", en: "Green (agriculture)" } },
  {
    value: "dp",
    label: { nl: "Dienstverlening en producten (D&P)", en: "Services & products (D&P)" },
  },
];

/** The four vmbo-tl / mavo sectoren (broader than the beroepsgerichte profielen). */
const VMBO_TL_SECTOREN: DomainOption[] = [
  { value: "techniek", label: { nl: "Techniek", en: "Technology" } },
  { value: "zorg-welzijn", label: { nl: "Zorg & welzijn", en: "Care & welfare" } },
  { value: "economie", label: { nl: "Economie", en: "Economics" } },
  { value: "groen", label: { nl: "Groen (landbouw)", en: "Green (agriculture)" } },
];

/** vo domain options per track — the leerweg/schooltype fixes which profielen apply. */
const VO_DOMAINS_BY_TRACK: Record<string, DomainOption[]> = {
  havo: HAVO_VWO_PROFIELEN,
  vwo: HAVO_VWO_PROFIELEN,
  "vmbo-bb": VMBO_PROFIELEN,
  "vmbo-kb": VMBO_PROFIELEN,
  "vmbo-gl": VMBO_PROFIELEN,
  "vmbo-tl": VMBO_TL_SECTOREN,
};

/** Sector-level domain options (track-independent). Absent sector = custom fields. */
export const DOMAINS_BY_SECTOR: Partial<
  Record<CountryCode, Partial<Record<Sector, DomainOption[]>>>
> = {
  NL: {
    hbo: HBO_DOMAIN_OPTIONS,
    // vo is track-scoped (see VO_DOMAINS_BY_TRACK); mbo, wo: no catalogue yet.
  },
};

/**
 * The domain/profiel options for a (country, sector, track), or [] when none are
 * catalogued / args are unknown. vo branches by track (profielen differ per
 * leerweg); every other sector is track-independent. Keep hbo byte-identical.
 */
export function getDomainsForTrack(
  country: string | undefined,
  sector: string | undefined,
  track: string | undefined,
): DomainOption[] {
  if (!country || !isCountryCode(country) || !sector || !isSector(sector)) return [];
  if (sector === "vo") return track ? (VO_DOMAINS_BY_TRACK[track] ?? []) : [];
  return DOMAINS_BY_SECTOR[country]?.[sector] ?? [];
}
