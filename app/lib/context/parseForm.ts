/**
 * Parse + validate a context-profile form submission from the stepped editor.
 * Security boundary: every field is validated against its catalogue — country,
 * sector, track, national level, domain (sector-scoped) and pack values are all
 * gated (no arbitrary values), and custom fields are trimmed, de-duplicated of
 * empties, and capped in count + length.
 */
import type { ContextProfile, CustomField, PackFieldValue } from "./types";
import { resolveFramework } from "./frameworks";
import { getDomainsForTrack } from "./domains";
import { isCountryCode, type CountryCode } from "./countries";
import { isSector, isVoPhase, learnerNounChoices, tracksForSector, type Sector } from "./sectors";
import {
  showsProgramme,
  showsProfessionalContext,
  showsPhase,
  showsStudyYear,
  showsDomain,
} from "./relevance";
import { isNlqfLevel, type NlqfLevel } from "./nlqf";
import { isEqfLevel } from "./eqf";

export const MAX_CUSTOM_FIELDS = 30;
export const MAX_CUSTOM_LABEL = 120;
export const MAX_CUSTOM_VALUE = 600;
export const MAX_PEDAGOGY = 300;

/** Input name prefix for domain-pack fields, e.g. `pack.architectuurlagen`. */
export const PACK_PREFIX = "pack.";

function str(v: FormDataEntryValue | null): string | undefined {
  const s = String(v ?? "").trim();
  return s || undefined;
}

/** A domain is valid only if it belongs to the (country, sector, track) catalogue. */
function validDomain(
  country: string,
  sector: string,
  track: string | undefined,
  raw: string | undefined,
): string | undefined {
  if (!raw) return undefined;
  return getDomainsForTrack(country, sector, track).some((d) => d.value === raw) ? raw : undefined;
}

/** Collect + validate the selected domain's pack answers from the form. */
function parsePackValues(
  fd: FormData,
  country: string,
  sector: string,
  domain: string | undefined,
): Record<string, PackFieldValue> | undefined {
  const pack = resolveFramework(country, sector, domain);
  if (!pack) return undefined;
  const out: Record<string, PackFieldValue> = {};

  for (const field of pack.fields) {
    const name = PACK_PREFIX + field.key;
    if (field.type === "level") {
      const n = Number(str(fd.get(name)));
      if (Number.isInteger(n) && n >= 1 && n <= (field.levelMax ?? 1)) out[field.key] = n;
      continue;
    }
    const allowed = new Set(field.options?.map((o) => o.value));
    const picked = fd
      .getAll(name)
      .map((v) => String(v))
      .filter((v) => allowed.has(v));
    if (field.type === "multiselect") {
      if (picked.length) out[field.key] = picked;
    } else if (picked[0]) {
      out[field.key] = picked[0]; // single-select
    }
  }

  return Object.keys(out).length ? out : undefined;
}

/** Zip parallel customLabel[]/customValue[] inputs into trimmed, capped pairs. */
function parseCustomFields(fd: FormData): CustomField[] | undefined {
  const labels = fd.getAll("customLabel").map((v) => String(v));
  const values = fd.getAll("customValue").map((v) => String(v));
  const out: CustomField[] = [];
  for (let i = 0; i < labels.length && out.length < MAX_CUSTOM_FIELDS; i++) {
    const label = (labels[i] ?? "").trim().slice(0, MAX_CUSTOM_LABEL);
    const value = (values[i] ?? "").trim().slice(0, MAX_CUSTOM_VALUE);
    if (label && value) out.push({ label, value });
  }
  return out.length ? out : undefined;
}

/** Availability sets the action re-validates submitted country/sector against. */
export interface ContextFormOptions {
  availableCountries?: string[];
  availableSectors?: string[];
}

export interface ParsedContextForm {
  input?: Omit<ContextProfile, "id">;
  isDefault: boolean;
  /** Set when validation fails. */
  error?: "name-required" | "country-not-available" | "sector-not-available";
}

export function parseContextForm(fd: FormData, opts: ContextFormOptions = {}): ParsedContextForm {
  const name = String(fd.get("name") ?? "").trim();
  const isDefault = fd.get("isDefault") === "on";
  if (!name) return { isDefault, error: "name-required" };

  // Server-side availability guard: a submitted country/sector must be in the
  // caller's available set. A hand-crafted POST for a disabled/unassigned one is
  // refused (the seam is default-open until P9 writes any settings).
  const rawCountry = str(fd.get("country"));
  const rawSector = str(fd.get("sector"));
  if (rawCountry && opts.availableCountries && !opts.availableCountries.includes(rawCountry)) {
    return { isDefault, error: "country-not-available" };
  }
  if (rawSector && opts.availableSectors && !opts.availableSectors.includes(rawSector)) {
    return { isDefault, error: "sector-not-available" };
  }

  // Stored (validated) axes vs the effective values used to resolve catalogues.
  // A legacy submission with no sector still resolves against hbo for domains/packs.
  const country: CountryCode | undefined = isCountryCode(rawCountry ?? "") ? "NL" : undefined;
  const sector: Sector | undefined = isSector(rawSector ?? "") ? (rawSector as Sector) : undefined;
  const effCountry = country ?? "NL";
  const effSector = sector ?? "hbo";

  const rawTrack = str(fd.get("track"));
  const track =
    rawTrack && tracksForSector(effSector).some((t) => t.value === rawTrack) ? rawTrack : undefined;

  const rawLevel = str(fd.get("nationalLevel"));
  const nationalLevel: NlqfLevel | undefined =
    rawLevel && isNlqfLevel(rawLevel) ? rawLevel : undefined;

  const rawNoun = str(fd.get("learnerNounOverride"));
  const learnerNounOverride =
    rawNoun && learnerNounChoices(effSector).includes(rawNoun) ? rawNoun : undefined;

  // The vo fase (onderbouw/bovenbouw) — server-defended off any non-vo sector.
  // Computed before domain because the profiel only applies in bovenbouw.
  const rawPhase = str(fd.get("phase"));
  const phase = showsPhase(effSector) && rawPhase && isVoPhase(rawPhase) ? rawPhase : undefined;

  const domain = showsDomain(effSector, phase)
    ? validDomain(effCountry, effSector, track, str(fd.get("domain")))
    : undefined;
  const yearRaw = String(fd.get("studyYear") ?? "");
  const eqfRaw = String(fd.get("eqf") ?? "");
  const year = Number(yearRaw);
  const eqf = Number(eqfRaw);

  const input: Omit<ContextProfile, "id"> = {
    name,
    country,
    sector,
    track,
    nationalLevel,
    learnerNounOverride,
    // Relevance defense (Phase 10): a hidden field isn't submitted by the editor,
    // but a hand-crafted POST could smuggle one — drop fields that don't apply to
    // the chosen sector/track so they never persist.
    programme: showsProgramme(effSector) ? str(fd.get("programme")) : undefined,
    domain,
    // The vo fase, server-defended off non-vo sectors above.
    phase,
    courseName: str(fd.get("courseName")),
    studyYear:
      showsStudyYear(effSector) && yearRaw && year >= 1 && year <= 4
        ? (year as 1 | 2 | 3 | 4)
        : undefined,
    // eqf is deprecated as an input (the level comes from nationalLevel); parsed
    // only for backward compatibility if a caller still submits it.
    eqf: eqfRaw && isEqfLevel(eqf) ? eqf : undefined,
    professionalContext: showsProfessionalContext(effSector, track)
      ? str(fd.get("professionalContext"))
      : undefined,
    tools: str(fd.get("tools")),
    pedagogy: str(fd.get("pedagogy"))?.slice(0, MAX_PEDAGOGY),
    packValues: parsePackValues(fd, effCountry, effSector, domain),
    customFields: parseCustomFields(fd),
  };

  return { input, isDefault };
}
