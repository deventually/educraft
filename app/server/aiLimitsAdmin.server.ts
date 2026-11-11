/**
 * Setting the monthly AI limits (PR D): the owner sets the institution's budget, an admin a
 * limit per team and per teacher. Checked here, in the action; every change is logged.
 */
import { parseEuroAmount } from "~/lib/usage/limits";
import { isOwner, type User } from "./auth.server";
import { getAiLimits, setAiLimit } from "./repositories/aiLimits.server";
import { recordAdminAction } from "./repositories/auditLog.server";
import { getTeamWithMembers, listTeams } from "./repositories/teams.server";
import { getUserById, listUsers } from "./repositories/users.server";

export type LimitResult =
  | { limitSaved: { name: string | null; cleared: boolean } }
  | { error: "ownerOnly" | "amount" | "unknown" };

/** Handles the intents `budget`, `teamLimit` and `userLimit`; null for any other intent. */
export async function setLimitFromForm(actor: User, fd: FormData): Promise<LimitResult | null> {
  const intent = String(fd.get("intent") ?? "");
  if (intent !== "budget" && intent !== "teamLimit" && intent !== "userLimit") return null;
  if (actor.role !== "admin") return { error: "ownerOnly" };
  const euros = parseEuroAmount(String(fd.get("euros") ?? ""));
  if (euros === "invalid") return { error: "amount" };
  const id = String(fd.get("id") ?? "");

  if (intent === "budget") {
    if (!(await isOwner(actor))) return { error: "ownerOnly" };
    await setAiLimit({ kind: "budget" }, euros);
    await log(actor, { kind: "budget", euros });
    return { limitSaved: { name: null, cleared: euros === null } };
  }
  if (intent === "teamLimit") {
    const team = await getTeamWithMembers(id);
    if (!team) return { error: "unknown" };
    await setAiLimit({ kind: "team", id }, euros);
    await log(actor, { kind: "team", name: team.name, euros });
    return { limitSaved: { name: team.name, cleared: euros === null } };
  }
  const person = await getUserById(id);
  if (!person || person.role === "admin") return { error: "unknown" };
  await setAiLimit({ kind: "user", id }, euros);
  await log(actor, { kind: "user", euros }, id);
  return { limitSaved: { name: person.name, cleared: euros === null } };
}

function log(
  actor: User,
  limit: { kind: "budget" | "team" | "user"; name?: string; euros: number | null },
  targetUserId?: string,
) {
  return recordAdminAction({
    actorUserId: actor.id,
    action: "aiLimitChanged",
    targetUserId: targetUserId ?? null,
    detail: { limit },
  });
}

/**
 * The limits as the admin's part of the usage page shows them: per team and per teacher for
 * every admin, the institution's budget only for the owner (BESLUIT-2026-11-11-1).
 */
export async function limitsView(owner: boolean) {
  const limits = await getAiLimits();
  const teams = (await listTeams()).map((t) => ({
    id: t.id,
    name: t.name,
    euros: limits.teams[t.id] ?? null,
  }));
  const people = (await listUsers())
    .filter((u) => u.role !== "admin" && !u.disabledAt)
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 500)
    .map((u) => ({ id: u.id, name: u.name, euros: limits.users[u.id] ?? null }));
  return { budget: owner ? { euros: limits.budget ?? null } : null, teams, people };
}
