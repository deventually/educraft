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
import { isSector, tracksForSector } from "./sectors";
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

/** A group of tracks that share an identical domain set (admin per-teacher UI). */
export interface DomainGroup {
  /** The tracks this group covers ([] for a track-independent sector like hbo). */
  tracks: string[];
  domains: DomainOption[];
}

/**
 * The domain groups to render for a sector in the admin per-teacher UI: hbo is a
 * single track-less group; vo merges tracks whose profiel set is identical
 * (havo+vwo, vmbo bb/kb/gl) so a slug isn't offered under six near-duplicate
 * headings. Sectors without a catalogue return []. Assignment is a flat slug set,
 * so this grouping is purely presentational.
 */
export function domainGroupsForSector(
  country: string | undefined,
  sector: string | undefined,
): DomainGroup[] {
  if (!country || !isCountryCode(country) || !sector || !isSector(sector)) return [];
  if (sector !== "vo") {
    const domains = DOMAINS_BY_SECTOR[country]?.[sector] ?? [];
    return domains.length ? [{ tracks: [], domains }] : [];
  }
  const groups: DomainGroup[] = [];
  for (const tr of tracksForSector(sector)) {
    const domains = getDomainsForTrack(country, sector, tr.value);
    if (!domains.length) continue;
    const sig = domains.map((d) => d.value).join(",");
    const existing = groups.find((g) => g.domains.map((d) => d.value).join(",") === sig);
    if (existing) existing.tracks.push(tr.value);
    else groups.push({ tracks: [tr.value], domains });
  }
  return groups;
}

/** Every valid domain slug across all sectors/tracks — the admin write-side filter. */
export function allDomainValues(country: string | undefined): string[] {
  if (!country || !isCountryCode(country)) return [];
  const values = new Set<string>();
  for (const opts of Object.values(DOMAINS_BY_SECTOR[country] ?? {})) {
    for (const o of opts ?? []) values.add(o.value);
  }
  // vo is track-scoped (outside DOMAINS_BY_SECTOR) and NL-only today.
  if (country === "NL") {
    for (const opts of Object.values(VO_DOMAINS_BY_TRACK)) {
      for (const o of opts) values.add(o.value);
    }
  }
  return [...values];
}
