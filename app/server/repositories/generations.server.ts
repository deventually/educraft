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

export function listGenerations(limit = 50): GenerationRow[] {
  return db.select().from(generations).orderBy(desc(generations.createdAt)).limit(limit).all();
}

export function getGeneration(id: string): GenerationRow | undefined {
  return db.select().from(generations).where(eq(generations.id, id)).get();
}

export function deleteGeneration(id: string) {
  db.delete(generations).where(eq(generations.id, id)).run();
}
