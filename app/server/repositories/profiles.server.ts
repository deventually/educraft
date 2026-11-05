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
import { contextProfiles, shares } from "../schema.server";
import type { ContextProfile } from "~/lib/context/types";
import { migrateLegacyProfile } from "~/lib/context/migrate";

function rowToProfile(row: typeof contextProfiles.$inferSelect): ContextProfile {
  const data = migrateLegacyProfile(JSON.parse(row.dataJson) as Record<string, unknown>);
  return { id: row.id, name: row.name, ...(data as Omit<ContextProfile, "id" | "name">) };
}

export async function listProfiles(userId: string, limit?: number): Promise<ContextProfile[]> {
  // Belt-and-braces cap (Phase 5.6): per-user scoping already bounds realistic
  // sizes, but never return an unbounded result set.
  const capped = Math.min(limit ?? 50, 500);
  return getDb()
    .select()
    .from(contextProfiles)
    .where(eq(contextProfiles.userId, userId))
    .limit(capped)
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
  // A teacher's first profile becomes the default even without the flag: chat
  // tools only use the default, so a lone profile must not be silently ignored.
  const makeDefault = isDefault || (await getDefaultProfile(userId)) === null;
  if (makeDefault) await clearDefault(userId);
  getDb()
    .insert(contextProfiles)
    .values({
      id,
      userId,
      name,
      dataJson: JSON.stringify(rest),
      isDefault: makeDefault,
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

/** Deletes the profile and its shares (P28.4). */
export async function deleteProfile(userId: string, id: string): Promise<void> {
  getDb().transaction((tx) => {
    const result = tx
      .delete(contextProfiles)
      .where(and(eq(contextProfiles.id, id), eq(contextProfiles.userId, userId)))
      .run();
    if (result.changes === 0) return;
    tx.delete(shares)
      .where(
        and(
          eq(shares.kind, "contextProfile"),
          eq(shares.itemId, id),
          eq(shares.ownerUserId, userId),
        ),
      )
      .run();
  });
}

async function clearDefault(userId: string): Promise<void> {
  getDb()
    .update(contextProfiles)
    .set({ isDefault: false })
    .where(eq(contextProfiles.userId, userId))
    .run();
}
