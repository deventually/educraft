/**
 * Read-time migration for stored context profiles (Phase 8) — a pure, idempotent
 * backfill run on every profile as it is deserialized (`profiles.server`). It
 * never touches the DB, so it is unit-tested directly. Two independent passes:
 *
 *  1. Legacy hbo-i pack fields (pre-pack model) → the generic ICT `packValues`.
 *  2. Phase 8 axes: `country`/`sector` default to the old hbo shape, and a legacy
 *     `eqf` seeds `nationalLevel` (so the level still resolves) — but never invents
 *     a level where none existed (no fabricated "instroom"). `eqf` is retained.
 *
 * Cohorts stay EQF-native and are NOT migrated (they carry no stored profile).
 */
import { DEFAULT_COUNTRY } from "./countries";
import { isEqfLevel } from "./eqf";
import type { PackFieldValue } from "./types";

/** Legacy hbo-i fields (pre-pack model) → the generic ICT packValues keys. */
interface LegacyIctData {
  architectureLayers?: string[];
  activities?: string[];
  hboiLevel?: number;
}

/** Pass 1 — fold the pre-pack hbo-i fields into `packValues` (idempotent). */
function migrateIctPack(data: Record<string, unknown>): Record<string, unknown> {
  const legacy = data as LegacyIctData;
  if (data.packValues || (!legacy.architectureLayers && !legacy.activities && !legacy.hboiLevel)) {
    return data;
  }
  const packValues: Record<string, PackFieldValue> = {};
  if (legacy.architectureLayers?.length) packValues.architectuurlagen = legacy.architectureLayers;
  if (legacy.activities?.length) packValues.activiteiten = legacy.activities;
  if (legacy.hboiLevel) packValues.beheersingsniveau = legacy.hboiLevel;
  const { architectureLayers, activities, hboiLevel, ...rest } = data as Record<string, unknown> &
    LegacyIctData;
  void architectureLayers;
  void activities;
  void hboiLevel;
  return { ...rest, packValues };
}

/**
 * Note (Phase 10): a pre-P10 flat-vo profile may carry a `domain` slug the new
 * track-scoped catalogue no longer offers (a kernvak like `nederlands`, or a
 * vmbo profiel stored on a havo profile). There is no cheap, honest normalization
 * — the correct target differs per profile — so we leave the stored value as-is
 * and handle it display-only: the editor preserves it as a selected option, and
 * `format.ts` injects its raw value when no label resolves. A conscious re-save
 * then normalizes it via `parseForm`'s track validation.
 */

/** Pass 2 — backfill the Phase 8 teaching-context axes (idempotent). */
function migrateAxes(data: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data };
  if (out.country == null) out.country = DEFAULT_COUNTRY;
  if (out.sector == null) out.sector = "hbo";
  // Seed the national level from a legacy eqf — but only when an eqf exists, so a
  // level-less profile stays level-less (we never fabricate an "instroom").
  if (out.nationalLevel == null && out.eqf != null && isEqfLevel(Number(out.eqf))) {
    out.nationalLevel = String(out.eqf);
  }
  return out;
}

/** The full read-time backfill: legacy pack fields, then the Phase 8 axes. */
export function migrateLegacyProfile(data: Record<string, unknown>): Record<string, unknown> {
  return migrateAxes(migrateIctPack(data));
}
