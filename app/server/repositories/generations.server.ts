/**
 * Repository rule (Phase 1): all DB access goes through repositories; every
 * exported signature is `async` and returns a Promise (portability insurance);
 * no better-sqlite3 API is used outside `db.server.ts`; and every query is
 * scoped to its owning `userId` in the WHERE clause (never trust the client).
 */
import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../db.server";
import { generations, type GenerationRow } from "../schema.server";

export interface SaveGenerationInput {
  userId: string;
  projectId?: string | null;
  toolSlug: string;
  stageId?: string | null;
  model: string;
  input: unknown;
  contextProfileId?: string | null;
  outputLanguage: string;
  outputMarkdown: string;
}

export async function saveGeneration(input: SaveGenerationInput): Promise<GenerationRow> {
  const id = randomUUID();
  const row: GenerationRow = {
    id,
    userId: input.userId,
    projectId: input.projectId ?? null,
    toolSlug: input.toolSlug,
    stageId: input.stageId ?? null,
    model: input.model,
    inputJson: JSON.stringify(input.input ?? {}),
    contextProfileId: input.contextProfileId ?? null,
    outputLanguage: input.outputLanguage,
    outputMarkdown: input.outputMarkdown,
    createdAt: new Date(),
  };
  getDb().insert(generations).values(row).run();
  return row;
}

export interface UpsertChatGenerationInput {
  /** Stable client-side session id; doubles as the generation's primary key. */
  id: string;
  userId: string;
  toolSlug: string;
  stageId?: string | null;
  model: string;
  input: unknown;
  contextProfileId?: string | null;
  outputLanguage: string;
  /** Full chat transcript as Markdown (replaces the prior turn's transcript). */
  transcript: string;
}

/**
 * Persist a chat session as a single generation row, keyed by its session id.
 * Each completed turn rewrites the same row with the full transcript so the
 * Projects page shows one entry per conversation, not one per message. The
 * original createdAt is preserved to keep list ordering stable across turns.
 */
export async function upsertChatGeneration(
  input: UpsertChatGenerationInput,
): Promise<GenerationRow> {
  const existing = await getGeneration(input.userId, input.id);
  const row: GenerationRow = {
    id: input.id,
    userId: input.userId,
    projectId: existing?.projectId ?? null,
    toolSlug: input.toolSlug,
    stageId: input.stageId ?? null,
    model: input.model,
    inputJson: JSON.stringify(input.input ?? {}),
    contextProfileId: input.contextProfileId ?? null,
    outputLanguage: input.outputLanguage,
    outputMarkdown: input.transcript,
    createdAt: existing?.createdAt ?? new Date(),
  };
  if (existing) {
    getDb()
      .update(generations)
      .set({
        toolSlug: row.toolSlug,
        stageId: row.stageId,
        model: row.model,
        inputJson: row.inputJson,
        contextProfileId: row.contextProfileId,
        outputLanguage: row.outputLanguage,
        outputMarkdown: row.outputMarkdown,
      })
      .where(and(eq(generations.id, input.id), eq(generations.userId, input.userId)))
      .run();
  } else {
    getDb().insert(generations).values(row).run();
  }
  return row;
}

export async function listGenerations(userId: string, limit = 50): Promise<GenerationRow[]> {
  return getDb()
    .select()
    .from(generations)
    .where(eq(generations.userId, userId))
    .orderBy(desc(generations.createdAt))
    .limit(limit)
    .all();
}

export async function getGeneration(
  userId: string,
  id: string,
): Promise<GenerationRow | undefined> {
  return getDb()
    .select()
    .from(generations)
    .where(and(eq(generations.id, id), eq(generations.userId, userId)))
    .get();
}

/**
 * Generation counts per tool over the last `days` days — the admin usage
 * "per tool" totals. Not user-scoped by design (an admin sees the whole
 * instance); cheap group-by, no analytics infrastructure.
 */
export async function countGenerationsByTool(
  days = 14,
): Promise<{ toolSlug: string; count: number }[]> {
  const cutoff = new Date(Date.now() - days * 86_400_000);
  return getDb()
    .select({ toolSlug: generations.toolSlug, count: sql<number>`count(*)` })
    .from(generations)
    .where(gte(generations.createdAt, cutoff))
    .groupBy(generations.toolSlug)
    .orderBy(desc(sql`count(*)`))
    .all();
}

export async function deleteGeneration(userId: string, id: string): Promise<void> {
  getDb()
    .delete(generations)
    .where(and(eq(generations.id, id), eq(generations.userId, userId)))
    .run();
}
