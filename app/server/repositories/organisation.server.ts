/**
 * The institution's divisions (BESLUIT-2026-11-12-2): the layer between the institution (this
 * environment, one database) and its programmes, named as the institution names it. Admin-only
 * writes, checked here; the rows hold no one's content, so reading is not scoped per user.
 * A division is deleted only while no programme sits under it.
 */
import { randomUUID } from "node:crypto";
import { asc, count, eq, isNotNull } from "drizzle-orm";
import {
  type DivisionKind,
  DivisionKindSchema,
  DivisionNameSchema,
} from "~/lib/organisation/kinds";
import { getDb } from "../db.server";
import { divisions, instanceSettings, programmes, teams } from "../schema.server";

/** Who acts: the signed-in user's id and role. */
interface Actor {
  id: string;
  role: string;
}

export interface Division {
  id: string;
  name: string;
}

const KIND_KEY = "divisionKind";
const isAdmin = (a: Actor) => a.role === "admin";

/** What the institution calls its divisions, or null while the admin has not chosen. */
export async function getDivisionKind(): Promise<DivisionKind | null> {
  const row = getDb()
    .select()
    .from(instanceSettings)
    .where(eq(instanceSettings.key, KIND_KEY))
    .get();
  if (!row) return null;
  try {
    const parsed = DivisionKindSchema.safeParse(JSON.parse(row.valueJson));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** False for a teacher or an unknown kind (nothing written). */
export async function setDivisionKind(a: Actor, kind: unknown): Promise<boolean> {
  const parsed = DivisionKindSchema.safeParse(kind);
  if (!isAdmin(a) || !parsed.success) return false;
  const valueJson = JSON.stringify(parsed.data);
  getDb()
    .insert(instanceSettings)
    .values({ key: KIND_KEY, valueJson, updatedAt: new Date() })
    .onConflictDoUpdate({ target: instanceSettings.key, set: { valueJson, updatedAt: new Date() } })
    .run();
  return true;
}

/** Every division by name, with how many programmes and which teams sit under it. */
export async function listDivisions(): Promise<
  (Division & { programmeCount: number; teams: Division[] })[]
> {
  const db = getDb();
  const rows = db
    .select({ id: divisions.id, name: divisions.name, programmeCount: count(programmes.id) })
    .from(divisions)
    .leftJoin(programmes, eq(programmes.divisionId, divisions.id))
    .groupBy(divisions.id)
    .orderBy(asc(divisions.name))
    .limit(500)
    .all();
  const placed = db
    .select({ id: teams.id, name: teams.name, divisionId: teams.divisionId })
    .from(teams)
    .where(isNotNull(teams.divisionId))
    .orderBy(asc(teams.name))
    .limit(500)
    .all();
  return rows.map((d) => ({
    ...d,
    teams: placed.filter((t) => t.divisionId === d.id).map(({ id, name }) => ({ id, name })),
  }));
}

/** Null for a teacher or an invalid name. */
export async function createDivision(a: Actor, name: unknown): Promise<Division | null> {
  const parsed = DivisionNameSchema.safeParse(name);
  if (!isAdmin(a) || !parsed.success) return null;
  const now = new Date();
  const row = { id: randomUUID(), name: parsed.data, createdAt: now, updatedAt: now };
  getDb().insert(divisions).values(row).run();
  return { id: row.id, name: row.name };
}

/** False for a teacher, an invalid name or an unknown division. */
export async function renameDivision(a: Actor, id: string, name: unknown): Promise<boolean> {
  const parsed = DivisionNameSchema.safeParse(name);
  if (!isAdmin(a) || !parsed.success) return false;
  const result = getDb()
    .update(divisions)
    .set({ name: parsed.data, updatedAt: new Date() })
    .where(eq(divisions.id, id))
    .run();
  return result.changes > 0;
}

/** Deletes an empty division; one with programmes or teams under it stays ("notEmpty"). */
export async function deleteDivision(
  a: Actor,
  id: string,
): Promise<"deleted" | "notEmpty" | "notFound" | "notAllowed"> {
  if (!isAdmin(a)) return "notAllowed";
  const db = getDb();
  const used = db
    .select({ id: programmes.id })
    .from(programmes)
    .where(eq(programmes.divisionId, id))
    .get();
  const team = db.select({ id: teams.id }).from(teams).where(eq(teams.divisionId, id)).get();
  if (used || team) return "notEmpty";
  const result = db.delete(divisions).where(eq(divisions.id, id)).run();
  return result.changes > 0 ? "deleted" : "notFound";
}

const divisionExists = (id: string | null) =>
  id === null ||
  !!getDb().select({ id: divisions.id }).from(divisions).where(eq(divisions.id, id)).get();

/** Puts a programme under a division, or under none (null). False for a teacher or unknown ids. */
export async function setProgrammeDivision(
  a: Actor,
  programmeId: string,
  divisionId: string | null,
): Promise<boolean> {
  if (!isAdmin(a) || !divisionExists(divisionId)) return false;
  const result = getDb()
    .update(programmes)
    .set({ divisionId, updatedAt: new Date() })
    .where(eq(programmes.id, programmeId))
    .run();
  return result.changes > 0;
}

/** Puts a team under a division, or under none (null). False for a teacher or unknown ids. */
export async function setTeamDivision(
  a: Actor,
  teamId: string,
  divisionId: string | null,
): Promise<boolean> {
  if (!isAdmin(a) || !divisionExists(divisionId)) return false;
  const result = getDb().update(teams).set({ divisionId }).where(eq(teams.id, teamId)).run();
  return result.changes > 0;
}

/** The division a team sits under (its own), or null. For admin callers only (not scoped). */
export async function teamDivisionId(teamId: string): Promise<string | null> {
  const row = getDb()
    .select({ divisionId: teams.divisionId })
    .from(teams)
    .where(eq(teams.id, teamId))
    .get();
  return row?.divisionId ?? null;
}

/**
 * Where each team sits, for the admin's lists: the names of its programmes, and its division
 * (the team's own, else the first of its programmes'). A team with neither is left out.
 * For admin callers only (not scoped); capped like every list.
 */
export async function teamPlaces(): Promise<
  Map<string, { programmes: string[]; division: string | null }>
> {
  const db = getDb();
  const names = new Map(
    db
      .select({ id: divisions.id, name: divisions.name })
      .from(divisions)
      .limit(500)
      .all()
      .map((d) => [d.id, d.name]),
  );
  const out = new Map<string, { programmes: string[]; division: string | null }>();
  const entry = (teamId: string) => {
    const hit = out.get(teamId) ?? { programmes: [], division: null };
    out.set(teamId, hit);
    return hit;
  };
  for (const t of db
    .select({ id: teams.id, divisionId: teams.divisionId })
    .from(teams)
    .limit(500)
    .all())
    if (t.divisionId && names.has(t.divisionId))
      entry(t.id).division = names.get(t.divisionId) ?? null;
  const rows = db
    .select({ teamId: programmes.teamId, name: programmes.name, divisionId: programmes.divisionId })
    .from(programmes)
    .orderBy(asc(programmes.name))
    .limit(500)
    .all();
  for (const p of rows) {
    const hit = entry(p.teamId);
    hit.programmes.push(p.name);
    if (!hit.division && p.divisionId) hit.division = names.get(p.divisionId) ?? null;
  }
  return out;
}
