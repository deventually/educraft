/**
 * A teacher's own choice of role agents ("hats"): which hats look at their courses. Owner-scoped:
 * every query filters on `userId`. Only hats in the registry are stored or returned; a hat the
 * teacher never touched has no row and follows its `teacherDefault`.
 */
import { eq, sql } from "drizzle-orm";
import { getAgent } from "~/lib/agents/registry";
import { type AgentStand, isAgentStand } from "~/lib/agents/types";
import { getDb } from "../db.server";
import { agentChoices } from "../schema.server";

export async function getAgentChoices(
  userId: string,
): Promise<Partial<Record<string, AgentStand>>> {
  const rows = getDb()
    .select({ agentId: agentChoices.agentId, choice: agentChoices.choice })
    .from(agentChoices)
    .where(eq(agentChoices.userId, userId))
    .all();
  const out: Partial<Record<string, AgentStand>> = {};
  for (const r of rows)
    if (getAgent(r.agentId) && isAgentStand(r.choice)) out[r.agentId] = r.choice;
  return out;
}

/** Saves the given hats' choices; hats left out keep theirs. */
export async function setAgentChoices(
  userId: string,
  choices: Partial<Record<string, AgentStand>>,
): Promise<void> {
  const now = new Date();
  const rows = Object.entries(choices)
    .filter((e): e is [string, AgentStand] => !!getAgent(e[0]) && isAgentStand(e[1]))
    .map(([agentId, choice]) => ({ userId, agentId, choice, updatedAt: now }));
  if (rows.length === 0) return;
  getDb()
    .insert(agentChoices)
    .values(rows)
    .onConflictDoUpdate({
      target: [agentChoices.userId, agentChoices.agentId],
      set: { choice: sql`excluded.choice`, updatedAt: now },
    })
    .run();
}
