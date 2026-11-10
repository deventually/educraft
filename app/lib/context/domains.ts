/**
 * Type-scoped subject/domain catalogue (Phase 8, track-scoped in Phase 10) — the
 * options the domain picker offers per country → sector → track. This is a
 * *picker*, not a framework: a domain here may or may not resolve a verified pack
 * (`frameworks.ts`). hbo reuses the existing `HBO_DOMAINS` at the sector level; vo
 * is scoped by track to the correct profielen; mbo and wo have a sector-level
 * catalogue. Nothing is invented as a framework here.
 *
 * Verified against the brief's sourced facts:
 *  - **havo & vwo** share the four profielen chosen in the tweede fase — Natuur &
 *    Techniek, Natuur & Gezondheid, Economie & Maatschappij, Cultuur &
 *    Maatschappij (Rijksoverheid; SLO `sectoren/havo-vwo/profielen/`).
 *  - **vmbo bb/kb/gl** → the ten beroepsgerichte profielen (Besluit profielen
 *    vmbo 22-04-2016; SLO `sectoren/vmbo/beroepsgericht/`).
 *  - **vmbo-tl / mavo** → the four sectoren (Techniek, Zorg & Welzijn, Economie,
 *    Landbouw/Groen).
 *  - **mbo** → the 18 opleidingsdomeinen of the *Regeling vaststelling
 *    kwalificatiedossiers en opleidingsdomeinen 2016* (as listed by CBS, 2021).
 *    Each is followed by the kwalificaties (crebo) that have a pack.
 *  - **wo** → the ten CROHO-onderdelen (DUO, *Handleiding CROHO op internet*).
 * The specific school subject belongs in the Course/"Vak" field, so kernvakken
 * are deliberately NOT part of this catalogue. Slugs are unique across sectors
 * (mbo-…, wo-…), because the admin switches domains on by slug.
 */
import type { LocalizedText } from "~/lib/i18n/localized";
import type { CountryCode } from "./countries";
import { isCountryCode } from "./countries";
import type { Sector } from "./sectors";
import { isSector, tracksForSector } from "./sectors";
import { MBO_QUALIFICATIONS } from "./packsMbo";
import { HBO_DOMAINS } from "./types";

export interface DomainOption {
  /** Stored on the profile as `domain`; validated against this catalogue. */
  value: string;
  label: LocalizedText;
  /** The picker groups options with the same group (an optgroup); mbo: the opleidingsdomein. */
  group?: LocalizedText;
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

/** The mbo opleidingsdomeinen (Regeling kwalificatiedossiers en opleidingsdomeinen 2016). */
const MBO_OPLEIDINGSDOMEINEN: DomainOption[] = [
  {
    value: "mbo-afbouw-hout-onderhoud",
    label: { nl: "Afbouw, hout en onderhoud", en: "Finishing, wood & maintenance" },
  },
  {
    value: "mbo-ambacht-lab-gezondheidstechniek",
    label: {
      nl: "Ambacht, laboratorium en gezondheidstechniek",
      en: "Crafts, laboratory & health technology",
    },
  },
  { value: "mbo-bouw-infra", label: { nl: "Bouw en infra", en: "Construction & infrastructure" } },
  { value: "mbo-cross-over", label: { nl: "Cross-over", en: "Cross-over (multiple domains)" } },
  {
    value: "mbo-economie-administratie",
    label: { nl: "Economie en administratie", en: "Business & administration" },
  },
  { value: "mbo-entree", label: { nl: "Entree", en: "Entry level (Entree)" } },
  {
    value: "mbo-handel-ondernemerschap",
    label: { nl: "Handel en ondernemerschap", en: "Trade & entrepreneurship" },
  },
  { value: "mbo-horeca-bakkerij", label: { nl: "Horeca en bakkerij", en: "Hospitality & bakery" } },
  {
    value: "mbo-ict",
    label: {
      nl: "Informatie en communicatietechnologie",
      en: "Information & communication technology",
    },
  },
  { value: "mbo-media-vormgeving", label: { nl: "Media en vormgeving", en: "Media & design" } },
  {
    value: "mbo-mobiliteit-voertuigen",
    label: { nl: "Mobiliteit en voertuigen", en: "Mobility & vehicles" },
  },
  {
    value: "mbo-techniek-procesindustrie",
    label: { nl: "Techniek en procesindustrie", en: "Engineering & process industry" },
  },
  {
    value: "mbo-toerisme-recreatie",
    label: { nl: "Toerisme en recreatie", en: "Tourism & recreation" },
  },
  {
    value: "mbo-transport-scheepvaart-logistiek",
    label: { nl: "Transport, scheepvaart en logistiek", en: "Transport, shipping & logistics" },
  },
  {
    value: "mbo-uiterlijke-verzorging",
    label: { nl: "Uiterlijke verzorging", en: "Personal care & beauty" },
  },
  { value: "mbo-veiligheid-sport", label: { nl: "Veiligheid en sport", en: "Security & sport" } },
  {
    value: "mbo-voedsel-natuur-leefomgeving",
    label: { nl: "Voedsel, natuur en leefomgeving", en: "Food, nature & living environment" },
  },
  { value: "mbo-zorg-welzijn", label: { nl: "Zorg en welzijn", en: "Care & welfare" } },
];

/**
 * The mbo picker: each opleidingsdomein, followed by its kwalificaties that have a
 * pack (`packsMbo.ts`), all grouped under the opleidingsdomein's name.
 */
const MBO_DOMAINS: DomainOption[] = MBO_OPLEIDINGSDOMEINEN.flatMap((d) => [
  { ...d, group: d.label },
  ...MBO_QUALIFICATIONS.filter((q) => q.opleidingsdomein === d.value).map((q) => ({
    value: q.value,
    label: q.label,
    group: d.label,
  })),
]);

/** The ten CROHO-onderdelen (DUO) — every wo programme is registered under one. */
const WO_CROHO_ONDERDELEN: DomainOption[] = [
  { value: "wo-economie", label: { nl: "Economie", en: "Economics" } },
  {
    value: "wo-gedrag-maatschappij",
    label: { nl: "Gedrag en maatschappij", en: "Behaviour & society" },
  },
  { value: "wo-gezondheidszorg", label: { nl: "Gezondheidszorg", en: "Healthcare" } },
  {
    value: "wo-landbouw-natuurlijke-omgeving",
    label: { nl: "Landbouw en natuurlijke omgeving", en: "Agriculture & natural environment" },
  },
  { value: "wo-natuur", label: { nl: "Natuur", en: "Natural sciences" } },
  { value: "wo-onderwijs", label: { nl: "Onderwijs", en: "Education" } },
  { value: "wo-recht", label: { nl: "Recht", en: "Law" } },
  { value: "wo-sectoroverstijgend", label: { nl: "Sectoroverstijgend", en: "Interdisciplinary" } },
  { value: "wo-taal-cultuur", label: { nl: "Taal en cultuur", en: "Language & culture" } },
  { value: "wo-techniek", label: { nl: "Techniek", en: "Engineering" } },
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
const DOMAINS_BY_SECTOR: Partial<Record<CountryCode, Partial<Record<Sector, DomainOption[]>>>> = {
  NL: {
    mbo: MBO_DOMAINS,
    hbo: HBO_DOMAIN_OPTIONS,
    wo: WO_CROHO_ONDERDELEN,
    // vo is track-scoped (see VO_DOMAINS_BY_TRACK).
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

/** Consecutive options with the same group, in order; ungrouped options form runs too. */
export function groupOptions(
  options: DomainOption[],
): { group?: DomainOption["group"]; options: DomainOption[] }[] {
  const runs: { group?: DomainOption["group"]; options: DomainOption[] }[] = [];
  for (const o of options) {
    const last = runs.at(-1);
    if (last && last.group === o.group) last.options.push(o);
    else runs.push({ group: o.group, options: [o] });
  }
  return runs;
}
