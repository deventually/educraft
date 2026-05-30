import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "../db.server";
import { generations, type GenerationRow } from "../schema.server";

export interface SaveGenerationInput {
  projectId?: string | null;
  toolSlug: string;
  stageId?: string | null;
  model: string;
  input: unknown;
  contextProfileId?: string | null;
  outputLanguage: string;
  outputMarkdown: string;
}

export function saveGeneration(input: SaveGenerationInput): GenerationRow {
  const id = randomUUID();
  const row: GenerationRow = {
    id,
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
  db.insert(generations).values(row).run();
  return row;
}

export interface UpsertChatGenerationInput {
  /** Stable client-side session id; doubles as the generation's primary key. */
  id: string;
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
export function upsertChatGeneration(input: UpsertChatGenerationInput): GenerationRow {
  const existing = getGeneration(input.id);
  const row: GenerationRow = {
    id: input.id,
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
    db.update(generations)
      .set({
        toolSlug: row.toolSlug,
        stageId: row.stageId,
        model: row.model,
        inputJson: row.inputJson,
        contextProfileId: row.contextProfileId,
        outputLanguage: row.outputLanguage,
        outputMarkdown: row.outputMarkdown,
      })
      .where(eq(generations.id, input.id))
      .run();
  } else {
    db.insert(generations).values(row).run();
  }
  return row;
}

export function listGenerations(limit = 50): GenerationRow[] {
  return db.select().from(generations).orderBy(desc(generations.createdAt)).limit(limit).all();
}

export function getGeneration(id: string): GenerationRow | undefined {
  return db.select().from(generations).where(eq(generations.id, id)).get();
}

export function deleteGeneration(id: string) {
  db.delete(generations).where(eq(generations.id, id)).run();
}
