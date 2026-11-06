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
import { and, desc, eq, inArray, type SQL } from "drizzle-orm";
import { getDb } from "../db.server";
import { feedback, generations, teamMembers, users, type FeedbackRow } from "../schema.server";

export interface UpsertFeedbackInput {
  userId: string;
  generationId: string;
  rating: number; // +1 / -1
  comment?: string | null;
  /** Pilot: minutes saved (0/15/30/60) and quality (1-5); absent = not answered. */
  minutesSaved?: number | null;
  quality?: number | null;
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
      minutesSaved: input.minutesSaved ?? null,
      quality: input.quality ?? null,
    };
    db.update(feedback)
      .set({
        rating: row.rating,
        comment: row.comment,
        minutesSaved: row.minutesSaved,
        quality: row.quality,
      })
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
    minutesSaved: input.minutesSaved ?? null,
    quality: input.quality ?? null,
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
  minutesSaved: number | null;
  quality: number | null;
  createdAt: Date;
  userId: string;
  userName: string | null;
  generationId: string;
  toolSlug: string | null;
}

/**
 * The users of a team, as a WHERE condition on `column` (pilot filter per team); no team
 * = no condition. Admin views only.
 */
export function inTeam(column: Parameters<typeof eq>[0], teamId?: string): SQL | undefined {
  if (!teamId) return undefined;
  return inArray(
    column,
    getDb()
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId)),
  );
}

/**
 * All feedback joined with the tool it targeted and the rater's name — the
 * owner-only admin list, optionally only of one team's members. Not user-scoped by
 * design (an admin sees everything).
 */
export async function listFeedbackWithContext(
  opts: { teamId?: string } = {},
): Promise<FeedbackWithContext[]> {
  return getDb()
    .select({
      id: feedback.id,
      rating: feedback.rating,
      comment: feedback.comment,
      minutesSaved: feedback.minutesSaved,
      quality: feedback.quality,
      createdAt: feedback.createdAt,
      userId: feedback.userId,
      userName: users.name,
      generationId: feedback.generationId,
      toolSlug: generations.toolSlug,
    })
    .from(feedback)
    .leftJoin(generations, eq(feedback.generationId, generations.id))
    .leftJoin(users, eq(feedback.userId, users.id))
    .where(inTeam(feedback.userId, opts.teamId))
    .orderBy(desc(feedback.createdAt))
    .all();
}

/** Remove all feedback left by a user (delete-my-data cascade). */
export async function deleteFeedbackForUser(userId: string): Promise<void> {
  getDb().delete(feedback).where(eq(feedback.userId, userId)).run();
}
