/**
 * A teacher's assessment models: framework + optional scale per document type, filled into
 * the assessment tool. Repository rule: async, every query scoped to the owning `userId`, and
 * every write re-parsed with `AssessmentModelDataSchema`, so an invalid model is never stored.
 */
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db.server";
import { assessmentModels } from "../schema.server";
import {
  ASSESSMENT_MODEL_LIMITS,
  type AssessmentModelData,
  AssessmentModelDataSchema,
} from "~/lib/assessment-models";

export interface AssessmentModel {
  id: string;
  name: string;
  data: AssessmentModelData;
}

function parseName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > ASSESSMENT_MODEL_LIMITS.name)
    throw new Error("Invalid assessment model name");
  return trimmed;
}

const parseData = (data: unknown): AssessmentModelData => AssessmentModelDataSchema.parse(data);

const rowToModel = (row: typeof assessmentModels.$inferSelect): AssessmentModel => ({
  id: row.id,
  name: row.name,
  data: parseData(JSON.parse(row.dataJson)),
});

export async function listAssessmentModels(
  userId: string,
  limit?: number,
): Promise<AssessmentModel[]> {
  return getDb()
    .select()
    .from(assessmentModels)
    .where(eq(assessmentModels.userId, userId))
    .orderBy(sql`${assessmentModels.name} collate nocase`)
    .limit(Math.min(limit ?? 50, 500))
    .all()
    .map(rowToModel);
}

export async function getAssessmentModel(
  userId: string,
  id: string,
): Promise<AssessmentModel | null> {
  const row = getDb()
    .select()
    .from(assessmentModels)
    .where(and(eq(assessmentModels.id, id), eq(assessmentModels.userId, userId)))
    .get();
  return row ? rowToModel(row) : null;
}

export async function createAssessmentModel(
  userId: string,
  name: string,
  data: unknown,
): Promise<AssessmentModel> {
  const model = { id: randomUUID(), name: parseName(name), data: parseData(data) };
  const now = new Date();
  getDb()
    .insert(assessmentModels)
    .values({
      id: model.id,
      userId,
      name: model.name,
      dataJson: JSON.stringify(model.data),
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return model;
}

/** Updates name and/or data. Null when the model is not the caller's; throws on invalid input. */
export async function updateAssessmentModel(
  userId: string,
  id: string,
  patch: { name?: string; data?: unknown },
): Promise<AssessmentModel | null> {
  const existing = await getAssessmentModel(userId, id);
  if (!existing) return null;
  const name = patch.name === undefined ? existing.name : parseName(patch.name);
  const data = patch.data === undefined ? existing.data : parseData(patch.data);
  getDb()
    .update(assessmentModels)
    .set({ name, dataJson: JSON.stringify(data), updatedAt: new Date() })
    .where(and(eq(assessmentModels.id, id), eq(assessmentModels.userId, userId)))
    .run();
  return { id, name, data };
}

export async function deleteAssessmentModel(userId: string, id: string): Promise<boolean> {
  const result = getDb()
    .delete(assessmentModels)
    .where(and(eq(assessmentModels.id, id), eq(assessmentModels.userId, userId)))
    .run();
  return result.changes > 0;
}
