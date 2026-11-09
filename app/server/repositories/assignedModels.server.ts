/**
 * Repository rule (Phase 1): all DB access goes through repositories; every
 * exported signature is `async` and returns a Promise; no better-sqlite3 API is
 * used outside `db.server.ts`.
 */
import { eq, like } from "drizzle-orm";
import { getDb } from "../db.server";
import { instanceSettings } from "../schema.server";

/**
 * A per-user list stored as an `instance_settings` key `${prefix}:${userId}`
 * (returns a `Set<string>` or null; null/empty = unset). Migration-free store;
 * today only the per-teacher model set (`assignedModels`) uses it.
 */
async function getAssignedList(prefix: string, userId: string): Promise<Set<string> | null> {
  const row = getDb()
    .select()
    .from(instanceSettings)
    .where(eq(instanceSettings.key, `${prefix}:${userId}`))
    .get();
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.valueJson) as string[];
    return Array.isArray(parsed) && parsed.length > 0 ? new Set(parsed) : null;
  } catch {
    return null;
  }
}

/**
 * A teacher's own model set (`assignedModels:<userId>`, migration-free storage).
 * Since P18 it OVERRIDES the instance set (and may be wider); null/empty = no own
 * set, the teacher follows the instance.
 */
export async function getUserAssignedModels(userId: string): Promise<Set<string> | null> {
  return getAssignedList("assignedModels", userId);
}

/**
 * Set (or clear) a per-user list — the setter half of `getAssignedList`. Writes
 * the `${prefix}:${userId}` instance_settings key with a JSON `string[]`; a
 * null/empty list deletes the key. No `users` column, no migration.
 */
async function setAssignedList(
  prefix: string,
  userId: string,
  ids: string[] | null,
): Promise<void> {
  const db = getDb();
  const key = `${prefix}:${userId}`;
  if (!ids || ids.length === 0) {
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

/**
 * Every teacher's own model set, as stored (the admin's models page counts who still
 * names a model). Not user-scoped by design: an admin sees the whole instance.
 */
export async function listAssignedModelSets(): Promise<string[][]> {
  const rows = getDb()
    .select()
    .from(instanceSettings)
    .where(like(instanceSettings.key, "assignedModels:%"))
    .all();
  return rows.flatMap((r) => {
    try {
      const parsed = JSON.parse(r.valueJson);
      return Array.isArray(parsed)
        ? [parsed.filter((x): x is string => typeof x === "string")]
        : [];
    } catch {
      return [];
    }
  });
}

/** Set (or clear, with null/[]) a per-teacher model assignment (Phase 13). */
export async function setUserAssignedModels(userId: string, ids: string[] | null): Promise<void> {
  return setAssignedList("assignedModels", userId, ids);
}
