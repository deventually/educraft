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
import { eq, like } from "drizzle-orm";
import { getDb } from "../db.server";
import { instanceSettings, toolSettings } from "../schema.server";
import { type FeatureId, isFeatureId } from "~/lib/features";
import { type InstanceStand, isInstanceStand } from "~/lib/features/rule";

/** Every tool stand an admin has set (P28.3); an untouched tool is absent (registry default). */
export async function getToolStands(): Promise<Map<string, InstanceStand>> {
  const rows = getDb().select().from(toolSettings).all();
  return new Map(
    rows.flatMap((r) => (isInstanceStand(r.stand) ? [[r.toolSlug, r.stand] as const] : [])),
  );
}

/** Set a tool's instance stand: Off, On or On request; null = back to the registry default. */
export async function setToolStand(slug: string, stand: InstanceStand | null): Promise<void> {
  getDb()
    .insert(toolSettings)
    .values({ toolSlug: slug, stand, updatedAt: new Date() })
    .onConflictDoUpdate({ target: toolSettings.toolSlug, set: { stand, updatedAt: new Date() } })
    .run();
}

const FEATURE_STAND_PREFIX = "featureStand:";

/** The instance stand of each feature an admin has set (P28.3); absent = the register default. */
export async function getFeatureStands(): Promise<Partial<Record<FeatureId, InstanceStand>>> {
  const rows = getDb()
    .select()
    .from(instanceSettings)
    .where(like(instanceSettings.key, `${FEATURE_STAND_PREFIX}%`))
    .all();
  const out: Partial<Record<FeatureId, InstanceStand>> = {};
  for (const r of rows) {
    const id = r.key.slice(FEATURE_STAND_PREFIX.length);
    let stand: unknown;
    try {
      stand = JSON.parse(r.valueJson);
    } catch {
      continue;
    }
    if (isFeatureId(id) && isInstanceStand(stand)) out[id] = stand;
  }
  return out;
}

export async function setFeatureStand(id: FeatureId, stand: InstanceStand): Promise<void> {
  const key = `${FEATURE_STAND_PREFIX}${id}`;
  const valueJson = JSON.stringify(stand);
  getDb()
    .insert(instanceSettings)
    .values({ key, valueJson, updatedAt: new Date() })
    .onConflictDoUpdate({ target: instanceSettings.key, set: { valueJson, updatedAt: new Date() } })
    .run();
}

const ENABLED_MODELS_KEY = "enabledModels";
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
 * The admin's sector allow-list, or null when unset (= whole catalogue, per the
 * `enabledModels` convention).
 */
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
 * Set the instance sector allow-list. `null` clears it back to the default (whole
 * catalogue); a non-empty list upserts it. The admin route's lockout guard forbids
 * an empty list, so this never stores `[]`.
 */
export async function setEnabledSectors(ids: string[] | null): Promise<void> {
  return setInstanceList(ENABLED_SECTORS_KEY, ids);
}

/** Set the instance domain allow-list (Phase 12); `null`/`[]` clears it (= all). */
export async function setEnabledDomains(ids: string[] | null): Promise<void> {
  return setInstanceList(ENABLED_DOMAINS_KEY, ids);
}

const OWNER_KEY = "ownerUserId";

/**
 * The super admin's user id (P18.6), or null when none is set. One owner per
 * instance, stored as a JSON string. The id says nothing by itself: `isOwner`
 * (auth.server) also demands that the user is currently an admin.
 */
export async function getOwnerUserId(): Promise<string | null> {
  const row = getDb()
    .select()
    .from(instanceSettings)
    .where(eq(instanceSettings.key, OWNER_KEY))
    .get();
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.valueJson);
    return typeof parsed === "string" && parsed ? parsed : null;
  } catch {
    return null;
  }
}

/** Set the owner (an existing admin's id); `null` clears it (= no owner). */
export async function setOwnerUserId(id: string | null): Promise<void> {
  const db = getDb();
  if (id === null) {
    db.delete(instanceSettings).where(eq(instanceSettings.key, OWNER_KEY)).run();
    return;
  }
  const valueJson = JSON.stringify(id);
  const existing = db
    .select()
    .from(instanceSettings)
    .where(eq(instanceSettings.key, OWNER_KEY))
    .get();
  if (existing) {
    db.update(instanceSettings)
      .set({ valueJson, updatedAt: new Date() })
      .where(eq(instanceSettings.key, OWNER_KEY))
      .run();
  } else {
    db.insert(instanceSettings).values({ key: OWNER_KEY, valueJson, updatedAt: new Date() }).run();
  }
}
