/**
 * Repository rule (Phase 1): all DB access goes through repositories; every
 * exported signature is `async` and returns a Promise; no better-sqlite3 API is
 * used outside `db.server.ts`.
 */
import { eq } from "drizzle-orm";
import { getDb } from "../db.server";
import { instanceSettings } from "../schema.server";

const DEFAULT_MODEL_KEY = "defaultModel";

/**
 * The institution's default model: what tools start on when neither the teacher nor
 * their team chose one. Null = unset (then `default` in config/models.json serves).
 */
export async function getDefaultModel(): Promise<string | null> {
  const row = getDb()
    .select()
    .from(instanceSettings)
    .where(eq(instanceSettings.key, DEFAULT_MODEL_KEY))
    .get();
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.valueJson);
    return typeof parsed === "string" && parsed ? parsed : null;
  } catch {
    return null;
  }
}

/** Set the institution's default model; `null` clears it. */
export async function setDefaultModel(id: string | null): Promise<void> {
  const db = getDb();
  if (id === null) {
    db.delete(instanceSettings).where(eq(instanceSettings.key, DEFAULT_MODEL_KEY)).run();
    return;
  }
  const valueJson = JSON.stringify(id);
  db.insert(instanceSettings)
    .values({ key: DEFAULT_MODEL_KEY, valueJson, updatedAt: new Date() })
    .onConflictDoUpdate({ target: instanceSettings.key, set: { valueJson, updatedAt: new Date() } })
    .run();
}
