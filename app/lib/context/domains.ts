/**
 * Sector-scoped subject/domain catalogue (Phase 8) — the options the domain
 * picker offers per sector. This is a *picker*, not a framework: a domain here
 * may or may not resolve a verified pack (`frameworks.ts`). hbo reuses the
 * existing `HBO_DOMAINS`; vo lists indicative subjects/profielen; mbo/wo have no
 * catalogue yet (→ custom fields).
 *
 * The vo list is INDICATIVE (the 10 vmbo beroepsgerichte profielen — verified
 * against SLO — plus a few kernvakken for havo/vwo). It carries no verified pack;
 * authoring real po/vo/mbo packs is a later content phase. Nothing is invented as
 * a framework here.
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

/**
 * Indicative vo domains: the 10 vmbo beroepsgerichte profielen (SLO) + kernvakken.
 * Values are stable slugs (no verified pack attaches to them today).
 */
const VO_DOMAIN_OPTIONS: DomainOption[] = [
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
  { value: "nederlands", label: { nl: "Nederlands", en: "Dutch" } },
  { value: "engels", label: { nl: "Engels", en: "English" } },
  { value: "wiskunde", label: { nl: "Wiskunde", en: "Mathematics" } },
];

/** Domain options per country → sector. Absent sector = no catalogue (custom fields). */
export const DOMAINS_BY_SECTOR: Partial<
  Record<CountryCode, Partial<Record<Sector, DomainOption[]>>>
> = {
  NL: {
    hbo: HBO_DOMAIN_OPTIONS,
    vo: VO_DOMAIN_OPTIONS,
    // mbo, wo: no catalogue yet → the editor shows custom fields only.
  },
};

/** The domain options for a sector, or [] when none are catalogued / args are unknown. */
export function getDomainsForSector(
  country: string | undefined,
  sector: string | undefined,
): DomainOption[] {
  if (!country || !isCountryCode(country) || !sector || !isSector(sector)) return [];
  return DOMAINS_BY_SECTOR[country]?.[sector] ?? [];
}
