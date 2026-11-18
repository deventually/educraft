/**
 * Repository rule (Phase 1): all DB access goes through repositories; every
 * exported signature is `async` and returns a Promise; no better-sqlite3 API is
 * used outside `db.server.ts`.
 *
 * Where a model id still lives, so the admin can only remove a model nothing points at.
 * Not user-scoped by design: the admin looks across the whole institution.
 */
import { eq, like, or } from "drizzle-orm";
import { getDb } from "../db.server";
import {
  agentReviews,
  aiUsage,
  aiUsageRollup,
  generations,
  instanceSettings,
  teams,
} from "../schema.server";
import { parseTeamSettings } from "~/lib/features/teamSettings";

/** Whether any result or counted call was made with the model (ever). */
export async function modelHasHistory(id: string): Promise<boolean> {
  const db = getDb();
  return (
    db.select({ id: generations.id }).from(generations).where(eq(generations.model, id)).get() !==
      undefined ||
    db
      .select({ id: agentReviews.id })
      .from(agentReviews)
      .where(eq(agentReviews.model, id))
      .get() !== undefined ||
    db.select({ id: aiUsage.id }).from(aiUsage).where(eq(aiUsage.model, id)).get() !== undefined ||
    db
      .select({ model: aiUsageRollup.model })
      .from(aiUsageRollup)
      .where(eq(aiUsageRollup.model, id))
      .get() !== undefined
  );
}

function names(valueJson: string, id: string): boolean {
  try {
    const v: unknown = JSON.parse(valueJson);
    return v === id || (Array.isArray(v) && v.includes(id));
  } catch {
    return false;
  }
}

/**
 * Whether a setting still names the model: the institution's default, a teacher's own set,
 * default or expensive models, or a team's set, default or expensive models. The allow-list
 * is left out: removing a model takes it off that list.
 */
export async function modelNamedInSettings(id: string): Promise<boolean> {
  const db = getDb();
  const rows = db
    .select()
    .from(instanceSettings)
    .where(
      or(
        eq(instanceSettings.key, "defaultModel"),
        like(instanceSettings.key, "defaultModel:%"),
        like(instanceSettings.key, "assignedModels:%"),
        like(instanceSettings.key, "extraModels:%"),
      ),
    )
    .all();
  if (rows.some((r) => names(r.valueJson, id))) return true;
  return db
    .select({ settingsJson: teams.settingsJson })
    .from(teams)
    .all()
    .some((t) => {
      const { models, defaultModel, extraModels } = parseTeamSettings(t.settingsJson);
      return (models ?? []).includes(id) || defaultModel === id || (extraModels ?? []).includes(id);
    });
}
