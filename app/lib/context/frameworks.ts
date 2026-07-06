/**
 * Framework seam (Phase 8) — resolve a verified domain pack by
 * country → sector → domain. This is the structure that lets verified national
 * frameworks grow as pure data: today only `NL.hbo` is populated (the existing
 * `DOMAIN_PACKS`); po/vo/mbo/wo are deliberately absent, so those sectors fall
 * back to the honest custom-fields path — **never an invented framework**. A
 * later content phase slots real po/vo/mbo packs into the registry with no engine
 * change.
 *
 * `getDomainPack`/`getPackField` (packs.ts) stay as the hbo-internal helpers; this
 * is the sector-aware entry point the engine + editor use.
 */
import type { CountryCode } from "./countries";
import type { Sector } from "./sectors";
import { DOMAIN_PACKS, type DomainPack } from "./packs";

/** Verified packs per country → sector → domain slug. Additive; hbo-only today. */
export const FRAMEWORK_REGISTRY: Partial<
  Record<CountryCode, Partial<Record<Sector, Record<string, DomainPack>>>>
> = {
  NL: {
    hbo: DOMAIN_PACKS as Record<string, DomainPack>,
  },
};

/**
 * The verified pack for a (country, sector, domain), or undefined when none is
 * registered — the signal to fall back to custom fields. Tolerant of loose
 * strings so callers can pass raw profile fields.
 */
export function resolveFramework(
  country: string | undefined,
  sector: string | undefined,
  domain: string | undefined,
): DomainPack | undefined {
  if (!country || !sector || !domain) return undefined;
  return FRAMEWORK_REGISTRY[country as CountryCode]?.[sector as Sector]?.[domain];
}
