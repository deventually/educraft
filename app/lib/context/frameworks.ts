/**
 * Framework seam (Phase 8) — resolve a verified domain pack by
 * country → sector → domain. This is the structure that lets verified national
 * frameworks grow as pure data: `NL.hbo` has a pack per domain (`DOMAIN_PACKS`),
 * and a sector can carry one pack that holds for all its domains (`NL.wo`: the
 * Dublin descriptors). vo/mbo are still absent, so those sectors fall back to the
 * honest custom-fields path — **never an invented framework**.
 *
 * `getDomainPack`/`getPackField` (packs.ts) stay as the hbo-internal helpers; this
 * is the sector-aware entry point the engine + editor use.
 */
import type { CountryCode } from "./countries";
import type { Sector } from "./sectors";
import { DOMAIN_PACKS, type DomainPack } from "./packs";
import { DUBLIN_PACK } from "./packsWo";

/** Verified packs per country → sector → domain slug. Additive; hbo-only today. */
const FRAMEWORK_REGISTRY: Partial<
  Record<CountryCode, Partial<Record<Sector, Record<string, DomainPack>>>>
> = {
  NL: {
    hbo: DOMAIN_PACKS as Record<string, DomainPack>,
  },
};

/** One pack for every domain of a sector, used when the domain has no pack of its own. */
const SECTOR_PACKS: Partial<Record<CountryCode, Partial<Record<Sector, DomainPack>>>> = {
  NL: {
    wo: DUBLIN_PACK,
  },
};

/**
 * The verified pack for a (country, sector, domain), or undefined when none is
 * registered — the signal to fall back to custom fields. A domain's own pack wins
 * over its sector's pack; without a domain there is no pack. Tolerant of loose
 * strings so callers can pass raw profile fields.
 */
export function resolveFramework(
  country: string | undefined,
  sector: string | undefined,
  domain: string | undefined,
): DomainPack | undefined {
  if (!country || !sector || !domain) return undefined;
  return (
    FRAMEWORK_REGISTRY[country as CountryCode]?.[sector as Sector]?.[domain] ??
    SECTOR_PACKS[country as CountryCode]?.[sector as Sector]
  );
}
