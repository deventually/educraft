/**
 * Saved rubrics (brief P23.2). Repository rule: async, every query scoped to the owning
 * `userId`, and every write re-parsed with `RubricDataSchema`, so an invalid rubric is never
 * stored. A rubric is edited as a whole, like a context profile.
 */
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db.server";
import { rubricScores, rubrics, shares } from "../schema.server";
import { RUBRIC_LIMITS, RubricDataSchema, type RubricData } from "~/lib/utilities/rubric";

export interface Rubric {
  id: string;
  name: string;
  data: RubricData;
  createdAt: Date;
  updatedAt: Date;
}

function parseName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > RUBRIC_LIMITS.name)
    throw new Error("Invalid rubric name");
  return trimmed;
}

const parseData = (data: unknown): RubricData => RubricDataSchema.parse(data) as RubricData;

function rowToRubric(row: typeof rubrics.$inferSelect): Rubric {
  return {
    id: row.id,
    name: row.name,
    data: parseData(JSON.parse(row.dataJson)),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listRubrics(userId: string, limit?: number): Promise<Rubric[]> {
  return getDb()
    .select()
    .from(rubrics)
    .where(eq(rubrics.userId, userId))
    .orderBy(desc(rubrics.updatedAt))
    .limit(Math.min(limit ?? 50, 500))
    .all()
    .map(rowToRubric);
}

export async function getRubric(userId: string, id: string): Promise<Rubric | null> {
  const row = getDb()
    .select()
    .from(rubrics)
    .where(and(eq(rubrics.id, id), eq(rubrics.userId, userId)))
    .get();
  return row ? rowToRubric(row) : null;
}

export async function createRubric(
  userId: string,
  name: string,
  data: RubricData,
): Promise<Rubric> {
  const parsed = parseData(data);
  const now = new Date();
  const row = {
    id: randomUUID(),
    userId,
    name: parseName(name),
    dataJson: JSON.stringify(parsed),
    createdAt: now,
    updatedAt: now,
  };
  getDb().insert(rubrics).values(row).run();
  return { id: row.id, name: row.name, data: parsed, createdAt: now, updatedAt: now };
}

/** Updates name and/or data. Null when the rubric is not the caller's; throws on invalid input. */
export async function updateRubric(
  userId: string,
  id: string,
  patch: { name?: string; data?: unknown },
): Promise<Rubric | null> {
  const existing = await getRubric(userId, id);
  if (!existing) return null;
  const name = patch.name === undefined ? existing.name : parseName(patch.name);
  const data = patch.data === undefined ? existing.data : parseData(patch.data);
  // Strictly later than the previous write, so "newest first" stays stable.
  const updatedAt = new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1));
  getDb()
    .update(rubrics)
    .set({ name, dataJson: JSON.stringify(data), updatedAt })
    .where(and(eq(rubrics.id, id), eq(rubrics.userId, userId)))
    .run();
  return { ...existing, name, data, updatedAt };
}

/** Deletes the rubric, its closed fill-ins (P23.3) and its shares (P28.4) together. */
export async function deleteRubric(userId: string, id: string): Promise<boolean> {
  return getDb().transaction((tx) => {
    const result = tx
      .delete(rubrics)
      .where(and(eq(rubrics.id, id), eq(rubrics.userId, userId)))
      .run();
    if (result.changes === 0) return false;
    tx.delete(rubricScores)
      .where(and(eq(rubricScores.rubricId, id), eq(rubricScores.userId, userId)))
      .run();
    tx.delete(shares)
      .where(and(eq(shares.kind, "rubric"), eq(shares.itemId, id), eq(shares.ownerUserId, userId)))
      .run();
    return true;
  });
}

export async function duplicateRubric(
  userId: string,
  id: string,
  name: string,
): Promise<Rubric | null> {
  const existing = await getRubric(userId, id);
  return existing ? createRubric(userId, name, existing.data) : null;
}
