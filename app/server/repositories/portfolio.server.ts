/**
 * BDB/BKE workplace dossiers (brief P25). Repository rule: async, every query
 * scoped to the owning `userId`, and every write re-parsed with
 * `DossierDataSchema` so the stored graph is always consistent.
 */
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db.server";
import { portfolioDossiers } from "../schema.server";
import { DossierDataSchema, LIMITS } from "~/lib/portfolio/schema";
import type { DossierData } from "~/lib/portfolio/types";

export interface Dossier {
  id: string;
  name: string;
  data: DossierData;
  createdAt: Date;
  updatedAt: Date;
}

function parseName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > LIMITS.name) throw new Error("Invalid dossier name");
  return trimmed;
}

function rowToDossier(row: typeof portfolioDossiers.$inferSelect): Dossier {
  return {
    id: row.id,
    name: row.name,
    data: DossierDataSchema.parse(JSON.parse(row.dataJson)) as DossierData,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listDossiers(userId: string, limit?: number): Promise<Dossier[]> {
  return getDb()
    .select()
    .from(portfolioDossiers)
    .where(eq(portfolioDossiers.userId, userId))
    .orderBy(desc(portfolioDossiers.updatedAt))
    .limit(Math.min(limit ?? 50, 500))
    .all()
    .map(rowToDossier);
}

export async function getDossier(userId: string, id: string): Promise<Dossier | null> {
  const row = getDb()
    .select()
    .from(portfolioDossiers)
    .where(and(eq(portfolioDossiers.id, id), eq(portfolioDossiers.userId, userId)))
    .get();
  return row ? rowToDossier(row) : null;
}

export async function createDossier(
  userId: string,
  name: string,
  data: DossierData,
): Promise<Dossier> {
  const parsed = DossierDataSchema.parse(data) as DossierData;
  const now = new Date();
  const row = {
    id: randomUUID(),
    userId,
    name: parseName(name),
    dataJson: JSON.stringify(parsed),
    createdAt: now,
    updatedAt: now,
  };
  getDb().insert(portfolioDossiers).values(row).run();
  return { id: row.id, name: row.name, data: parsed, createdAt: now, updatedAt: now };
}

/** Updates name and/or data. Returns null when the dossier is not the caller's; throws on invalid data. */
export async function updateDossier(
  userId: string,
  id: string,
  patch: { name?: string; data?: DossierData },
): Promise<Dossier | null> {
  const existing = await getDossier(userId, id);
  if (!existing) return null;
  const name = patch.name === undefined ? existing.name : parseName(patch.name);
  const data =
    patch.data === undefined ? existing.data : (DossierDataSchema.parse(patch.data) as DossierData);
  // Strictly later than the previous write, so "newest first" stays stable.
  const updatedAt = new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1));
  getDb()
    .update(portfolioDossiers)
    .set({ name, dataJson: JSON.stringify(data), updatedAt })
    .where(and(eq(portfolioDossiers.id, id), eq(portfolioDossiers.userId, userId)))
    .run();
  return { ...existing, name, data, updatedAt };
}

export async function deleteDossier(userId: string, id: string): Promise<boolean> {
  const result = getDb()
    .delete(portfolioDossiers)
    .where(and(eq(portfolioDossiers.id, id), eq(portfolioDossiers.userId, userId)))
    .run();
  return result.changes > 0;
}
