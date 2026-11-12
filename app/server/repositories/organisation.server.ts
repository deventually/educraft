/**
 * The institution's divisions (BESLUIT-2026-11-12-2): the layer between the institution (this
 * environment, one database) and its programmes, named as the institution names it. Admin-only
 * writes, checked here; the rows hold no one's content, so reading is not scoped per user.
 * A division is deleted only while no programme sits under it.
 */
import { randomUUID } from "node:crypto";
import { asc, count, eq } from "drizzle-orm";
import {
  type DivisionKind,
  DivisionKindSchema,
  DivisionNameSchema,
} from "~/lib/organisation/kinds";
import { getDb } from "../db.server";
import { divisions, instanceSettings, programmes } from "../schema.server";

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

/** Every division by name, with how many programmes sit under it. */
export async function listDivisions(): Promise<(Division & { programmeCount: number })[]> {
  return getDb()
    .select({ id: divisions.id, name: divisions.name, programmeCount: count(programmes.id) })
    .from(divisions)
    .leftJoin(programmes, eq(programmes.divisionId, divisions.id))
    .groupBy(divisions.id)
    .orderBy(asc(divisions.name))
    .limit(500)
    .all();
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

/** Deletes an empty division; one with programmes under it stays ("notEmpty"). */
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
  if (used) return "notEmpty";
  const result = db.delete(divisions).where(eq(divisions.id, id)).run();
  return result.changes > 0 ? "deleted" : "notFound";
}

/** Puts a programme under a division, or under none (null). False for a teacher or unknown ids. */
export async function setProgrammeDivision(
  a: Actor,
  programmeId: string,
  divisionId: string | null,
): Promise<boolean> {
  if (!isAdmin(a)) return false;
  const db = getDb();
  if (
    divisionId !== null &&
    !db.select({ id: divisions.id }).from(divisions).where(eq(divisions.id, divisionId)).get()
  )
    return false;
  const result = db
    .update(programmes)
    .set({ divisionId, updatedAt: new Date() })
    .where(eq(programmes.id, programmeId))
    .run();
  return result.changes > 0;
}
