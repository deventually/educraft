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

/** The admin's model allow-list, or null when unset (= whole catalog). */
export async function getEnabledModels(): Promise<string[] | null> {
  const row = getDb()
    .select()
    .from(instanceSettings)
    .where(eq(instanceSettings.key, ENABLED_MODELS_KEY))
    .get();
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.valueJson);
    return Array.isArray(parsed) ? (parsed as string[]) : null;
  } catch {
    return null;
  }
}

/** Set the model allow-list; `null` clears it back to the default (whole catalog). */
export async function setEnabledModels(ids: string[] | null): Promise<void> {
  const db = getDb();
  if (ids === null) {
    db.delete(instanceSettings).where(eq(instanceSettings.key, ENABLED_MODELS_KEY)).run();
    return;
  }
  const valueJson = JSON.stringify(ids);
  const existing = db
    .select()
    .from(instanceSettings)
    .where(eq(instanceSettings.key, ENABLED_MODELS_KEY))
    .get();
  if (existing) {
    db.update(instanceSettings)
      .set({ valueJson, updatedAt: new Date() })
      .where(eq(instanceSettings.key, ENABLED_MODELS_KEY))
      .run();
  } else {
    db.insert(instanceSettings)
      .values({ key: ENABLED_MODELS_KEY, valueJson, updatedAt: new Date() })
      .run();
  }
}
