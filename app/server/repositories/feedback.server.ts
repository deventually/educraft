/**
 * Repository rule (Phase 1): all DB access goes through repositories; every
 * exported signature is `async` and returns a Promise; no better-sqlite3 API is
 * used outside `db.server.ts`.
 *
 * Structured tester feedback (audit finding #9). One row per (userId,
 * generationId) — re-rating updates in place. Ownership of the referenced
 * generation is verified by the route before calling `upsertFeedback`.
 */
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db.server";
import { feedback, generations, users, type FeedbackRow } from "../schema.server";

export interface UpsertFeedbackInput {
  userId: string;
  generationId: string;
  rating: number; // +1 / -1
  comment?: string | null;
}

/** Insert or update the user's single feedback row for a generation. */
export async function upsertFeedback(input: UpsertFeedbackInput): Promise<FeedbackRow> {
  const db = getDb();
  const existing = db
    .select()
    .from(feedback)
    .where(and(eq(feedback.userId, input.userId), eq(feedback.generationId, input.generationId)))
    .get();

  if (existing) {
    const row: FeedbackRow = {
      ...existing,
      rating: input.rating,
      comment: input.comment ?? null,
    };
    db.update(feedback)
      .set({ rating: row.rating, comment: row.comment })
      .where(and(eq(feedback.userId, input.userId), eq(feedback.generationId, input.generationId)))
      .run();
    return row;
  }

  const row: FeedbackRow = {
    id: randomUUID(),
    generationId: input.generationId,
    userId: input.userId,
    rating: input.rating,
    comment: input.comment ?? null,
    createdAt: new Date(),
  };
  db.insert(feedback).values(row).run();
  return row;
}

/** All feedback, newest first — the owner-only admin list. */
export async function listAllFeedback(): Promise<FeedbackRow[]> {
  return getDb().select().from(feedback).orderBy(desc(feedback.createdAt)).all();
}

export interface FeedbackWithContext {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  userId: string;
  userName: string | null;
  generationId: string;
  toolSlug: string | null;
}

/**
 * All feedback joined with the tool it targeted and the rater's name — the
 * owner-only admin list. Not user-scoped by design (an admin sees everything).
 */
export async function listFeedbackWithContext(): Promise<FeedbackWithContext[]> {
  return getDb()
    .select({
      id: feedback.id,
      rating: feedback.rating,
      comment: feedback.comment,
      createdAt: feedback.createdAt,
      userId: feedback.userId,
      userName: users.name,
      generationId: feedback.generationId,
      toolSlug: generations.toolSlug,
    })
    .from(feedback)
    .leftJoin(generations, eq(feedback.generationId, generations.id))
    .leftJoin(users, eq(feedback.userId, users.id))
    .orderBy(desc(feedback.createdAt))
    .all();
}

/** Remove all feedback left by a user (delete-my-data cascade). */
export async function deleteFeedbackForUser(userId: string): Promise<void> {
  getDb().delete(feedback).where(eq(feedback.userId, userId)).run();
}
