/**
 * Instance configuration repository (Phase 4). Backs the admin console: which
 * tools are available (and to whom) and which models a caller may pick.
 *
 * Repository rule (Phase 1): all DB access goes through repositories; every
 * exported *DB* function is async; no better-sqlite3 API outside `db.server.ts`.
 *
 * Safe defaults are the whole point: an absent `tool_settings` row means
 * "registry default", and an absent `enabledModels` key means "the whole
 * client-selectable catalog". A fresh instance with empty tables therefore
 * behaves exactly as it did before this phase.
 */
import { eq } from "drizzle-orm";
import { getDb } from "../db.server";
import { instanceSettings, toolSettings, type ToolSettingRow } from "../schema.server";

/** Every tool setting an admin has touched (untouched tools have no row). */
export async function getToolSettings(): Promise<ToolSettingRow[]> {
  return getDb().select().from(toolSettings).all();
}

/** One tool's setting, or null when untouched (= registry default). */
export async function getToolSetting(slug: string): Promise<ToolSettingRow | null> {
  return getDb().select().from(toolSettings).where(eq(toolSettings.toolSlug, slug)).get() ?? null;
}

export interface ToolSettingPatch {
  enabled?: boolean | null;
  audienceOverride?: string | null;
}

/**
 * Upsert a tool setting, merging in place — only the keys present in `patch`
 * change, so toggling `enabled` never clobbers an `audienceOverride` (and vice
 * versa).
 */
export async function setToolSetting(slug: string, patch: ToolSettingPatch): Promise<void> {
  const db = getDb();
  const existing = db.select().from(toolSettings).where(eq(toolSettings.toolSlug, slug)).get();
  const next: ToolSettingRow = {
    toolSlug: slug,
    enabled: patch.enabled !== undefined ? patch.enabled : (existing?.enabled ?? null),
    audienceOverride:
      patch.audienceOverride !== undefined
        ? patch.audienceOverride
        : (existing?.audienceOverride ?? null),
    updatedAt: new Date(),
  };
  if (existing) {
    db.update(toolSettings)
      .set({
        enabled: next.enabled,
        audienceOverride: next.audienceOverride,
        updatedAt: next.updatedAt,
      })
      .where(eq(toolSettings.toolSlug, slug))
      .run();
  } else {
    db.insert(toolSettings).values(next).run();
  }
}

const ENABLED_MODELS_KEY = "enabledModels";
const ENABLED_COUNTRIES_KEY = "enabledCountries";
const ENABLED_SECTORS_KEY = "enabledSectors";
const ENABLED_DOMAINS_KEY = "enabledDomains";

/** Read an instance_settings JSON `string[]` list by key, or null when unset. */
async function getInstanceList(key: string): Promise<string[] | null> {
  const row = getDb().select().from(instanceSettings).where(eq(instanceSettings.key, key)).get();
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.valueJson);
    return Array.isArray(parsed) ? (parsed as string[]) : null;
  } catch {
    return null;
  }
}

/** The admin's model allow-list, or null when unset (= whole catalog). */
export async function getEnabledModels(): Promise<string[] | null> {
  return getInstanceList(ENABLED_MODELS_KEY);
}

/**
 * The admin's country/sector allow-lists (Phase 8), or null when unset (= whole
 * catalogue, per the `enabledModels` convention). Read side only — the setters +
 * admin write UI are P9, so these return null until then (non-breaking).
 */
export async function getEnabledCountries(): Promise<string[] | null> {
  return getInstanceList(ENABLED_COUNTRIES_KEY);
}

export async function getEnabledSectors(): Promise<string[] | null> {
  return getInstanceList(ENABLED_SECTORS_KEY);
}

/**
 * The admin's instance domain/profiel allow-list (Phase 12), or null when unset
 * (= whole catalogue). The instance analog of the per-teacher domain assignment;
 * a flat slug set filtered against each track catalogue at read time.
 */
export async function getEnabledDomains(): Promise<string[] | null> {
  return getInstanceList(ENABLED_DOMAINS_KEY);
}

/** Upsert an instance_settings JSON `string[]` list by key; `null` deletes it. */
async function setInstanceList(key: string, ids: string[] | null): Promise<void> {
  const db = getDb();
  if (ids === null) {
    db.delete(instanceSettings).where(eq(instanceSettings.key, key)).run();
    return;
  }
  const valueJson = JSON.stringify(ids);
  const existing = db.select().from(instanceSettings).where(eq(instanceSettings.key, key)).get();
  if (existing) {
    db.update(instanceSettings)
      .set({ valueJson, updatedAt: new Date() })
      .where(eq(instanceSettings.key, key))
      .run();
  } else {
    db.insert(instanceSettings).values({ key, valueJson, updatedAt: new Date() }).run();
  }
}

/** Set the model allow-list; `null` clears it back to the default (whole catalog). */
export async function setEnabledModels(ids: string[] | null): Promise<void> {
  return setInstanceList(ENABLED_MODELS_KEY, ids);
}

/**
 * Set the instance country/sector allow-lists (Phase 9 write side). `null` clears
 * a list back to the default (whole catalogue); a non-empty list upserts it. The
 * admin route's lockout guard forbids an empty list, so these never store `[]`.
 */
export async function setEnabledCountries(ids: string[] | null): Promise<void> {
  return setInstanceList(ENABLED_COUNTRIES_KEY, ids);
}

export async function setEnabledSectors(ids: string[] | null): Promise<void> {
  return setInstanceList(ENABLED_SECTORS_KEY, ids);
}

/** Set the instance domain allow-list (Phase 12); `null`/`[]` clears it (= all). */
export async function setEnabledDomains(ids: string[] | null): Promise<void> {
  return setInstanceList(ENABLED_DOMAINS_KEY, ids);
}
