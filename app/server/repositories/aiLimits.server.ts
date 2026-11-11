/**
 * Repository rule: all DB access goes through repositories; every exported function is
 * `async`. Instance-wide (no `userId`): the monthly AI limits in euros, one `instance_settings`
 * value, parsed by `parseAiLimits` so a broken entry never breaks the gate.
 */
import { eq } from "drizzle-orm";
import { type AiLimits, parseAiLimits } from "~/lib/usage/limits";
import { getDb } from "../db.server";
import { instanceSettings } from "../schema.server";

const KEY = "aiLimits";

export async function getAiLimits(): Promise<AiLimits> {
  const row = getDb().select().from(instanceSettings).where(eq(instanceSettings.key, KEY)).get();
  if (!row) return parseAiLimits(undefined);
  try {
    return parseAiLimits(JSON.parse(row.valueJson));
  } catch {
    return parseAiLimits(undefined);
  }
}

/** The kind of limit and, for a team or a teacher, whose. */
export type LimitTarget = { kind: "budget" } | { kind: "team" | "user"; id: string };

/** Set one limit in euros per month; null removes it. The caller validated the amount. */
export async function setAiLimit(target: LimitTarget, euros: number | null): Promise<void> {
  const limits = await getAiLimits();
  if (target.kind === "budget") {
    if (euros === null) delete limits.budget;
    else limits.budget = euros;
  } else {
    const map = target.kind === "team" ? limits.teams : limits.users;
    if (euros === null) delete map[target.id];
    else map[target.id] = euros;
  }
  const valueJson = JSON.stringify(limits);
  getDb()
    .insert(instanceSettings)
    .values({ key: KEY, valueJson, updatedAt: new Date() })
    .onConflictDoUpdate({ target: instanceSettings.key, set: { valueJson, updatedAt: new Date() } })
    .run();
}
