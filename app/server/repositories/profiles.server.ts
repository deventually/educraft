/**
 * Repository rule (Phase 1): all DB access goes through repositories; every
 * exported signature is `async` and returns a Promise (portability insurance —
 * better-sqlite3 resolves synchronously today, a Postgres/MySQL port stays a
 * port); no better-sqlite3 API is used outside `db.server.ts`; and every query
 * is scoped to its owning `userId` in the WHERE clause (never trust the client
 * to filter).
 */
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db.server";
import { contextProfiles } from "../schema.server";
import { getCohortForUser } from "./cohorts.server";
import type { ContextProfile, PackFieldValue } from "~/lib/context/types";

/** Legacy hbo-i fields (pre-pack model) → the generic ICT packValues keys. */
interface LegacyIctData {
  architectureLayers?: string[];
  activities?: string[];
  hboiLevel?: number;
}

function migrateLegacy(data: Record<string, unknown>): Record<string, unknown> {
  const legacy = data as LegacyIctData;
  if (data.packValues || (!legacy.architectureLayers && !legacy.activities && !legacy.hboiLevel)) {
    return data;
  }
  const packValues: Record<string, PackFieldValue> = {};
  if (legacy.architectureLayers?.length) packValues.architectuurlagen = legacy.architectureLayers;
  if (legacy.activities?.length) packValues.activiteiten = legacy.activities;
  if (legacy.hboiLevel) packValues.beheersingsniveau = legacy.hboiLevel;
  const { architectureLayers, activities, hboiLevel, ...rest } = data as Record<string, unknown> &
    LegacyIctData;
  void architectureLayers;
  void activities;
  void hboiLevel;
  return { ...rest, packValues };
}

function rowToProfile(row: typeof contextProfiles.$inferSelect): ContextProfile {
  const data = migrateLegacy(JSON.parse(row.dataJson) as Record<string, unknown>);
  return { id: row.id, name: row.name, ...(data as Omit<ContextProfile, "id" | "name">) };
}

export async function listProfiles(userId: string): Promise<ContextProfile[]> {
  return getDb()
    .select()
    .from(contextProfiles)
    .where(eq(contextProfiles.userId, userId))
    .all()
    .map(rowToProfile);
}

export async function getProfile(userId: string, id: string): Promise<ContextProfile | null> {
  const row = getDb()
    .select()
    .from(contextProfiles)
    .where(and(eq(contextProfiles.id, id), eq(contextProfiles.userId, userId)))
    .get();
  return row ? rowToProfile(row) : null;
}

/**
 * Read a context profile a student is authorised to see **by cohort membership**,
 * not by ownership (Phase 6.6). This is the one sanctioned bypass of the
 * owner-scoping rule: a student never owns the teacher's profile, but membership
 * in a cohort that references it grants read access so the server can inject the
 * programme level on the student's behalf. Returns null unless the user's active
 * cohort actually references `profileId`.
 */
export async function getProfileForMember(
  userId: string,
  profileId: string,
): Promise<ContextProfile | null> {
  const cohort = await getCohortForUser(userId);
  if (!cohort || cohort.contextProfileId !== profileId) return null;
  const row = getDb().select().from(contextProfiles).where(eq(contextProfiles.id, profileId)).get();
  return row ? rowToProfile(row) : null;
}

export async function getDefaultProfile(userId: string): Promise<ContextProfile | null> {
  const row = getDb()
    .select()
    .from(contextProfiles)
    .where(and(eq(contextProfiles.userId, userId), eq(contextProfiles.isDefault, true)))
    .get();
  return row ? rowToProfile(row) : null;
}

export async function createProfile(
  userId: string,
  input: Omit<ContextProfile, "id">,
  isDefault = false,
): Promise<ContextProfile> {
  const id = randomUUID();
  const { name, ...rest } = input;
  if (isDefault) await clearDefault(userId);
  getDb()
    .insert(contextProfiles)
    .values({
      id,
      userId,
      name,
      dataJson: JSON.stringify(rest),
      isDefault,
      createdAt: new Date(),
    })
    .run();
  return { id, ...input };
}

export async function updateProfile(
  userId: string,
  id: string,
  input: Omit<ContextProfile, "id">,
  isDefault?: boolean,
): Promise<void> {
  const { name, ...rest } = input;
  if (isDefault) await clearDefault(userId);
  getDb()
    .update(contextProfiles)
    .set({
      name,
      dataJson: JSON.stringify(rest),
      ...(isDefault === undefined ? {} : { isDefault }),
    })
    .where(and(eq(contextProfiles.id, id), eq(contextProfiles.userId, userId)))
    .run();
}

export async function deleteProfile(userId: string, id: string): Promise<void> {
  getDb()
    .delete(contextProfiles)
    .where(and(eq(contextProfiles.id, id), eq(contextProfiles.userId, userId)))
    .run();
}

async function clearDefault(userId: string): Promise<void> {
  getDb()
    .update(contextProfiles)
    .set({ isDefault: false })
    .where(eq(contextProfiles.userId, userId))
    .run();
}
