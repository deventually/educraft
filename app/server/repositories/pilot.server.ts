/**
 * Repository rule (Phase 1): all DB access goes through repositories; every
 * exported signature is `async` and returns a Promise; no better-sqlite3 API is
 * used outside `db.server.ts`.
 *
 * Pilot feedback: the periodic check-in (scoped to its `userId`) and the admin
 * overview per tool, optionally per team. The admin reads are not user-scoped by
 * design, like `listFeedbackWithContext`.
 */
import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { checkinDue, summarizeByTool, type ToolSummary } from "~/lib/pilot";
import { getDb } from "../db.server";
import { feedback, generations, pilotCheckins, users } from "../schema.server";
import { inTeam } from "./feedback.server";

export interface CheckinAnswers {
  helped?: string;
  annoyed?: string;
  missing?: string;
}

const clean = (s?: string) => (s?.trim() ? s.trim() : null);

/** Store the teacher's answers. Spaces out the next prompt like a dismissal. */
export async function saveCheckin(userId: string, answers: CheckinAnswers): Promise<void> {
  getDb()
    .insert(pilotCheckins)
    .values({
      id: randomUUID(),
      userId,
      helped: clean(answers.helped),
      annoyed: clean(answers.annoyed),
      missing: clean(answers.missing),
      dismissed: false,
      createdAt: new Date(),
    })
    .run();
}

/** "Not now": remember when, so the check-in stays away for a while. */
export async function dismissCheckin(userId: string): Promise<void> {
  getDb()
    .insert(pilotCheckins)
    .values({ id: randomUUID(), userId, dismissed: true, createdAt: new Date() })
    .run();
}

/** Whether to show the check-in to this teacher now (`checkinDue`). */
export async function isCheckinDue(userId: string, now = new Date()): Promise<boolean> {
  const db = getDb();
  const last = db
    .select({ createdAt: pilotCheckins.createdAt })
    .from(pilotCheckins)
    .where(eq(pilotCheckins.userId, userId))
    .orderBy(desc(pilotCheckins.createdAt))
    .limit(1)
    .get();
  const count = db
    .select({ n: sql<number>`count(*)` })
    .from(generations)
    .where(eq(generations.userId, userId))
    .get();
  return checkinDue({ generationCount: count?.n ?? 0, lastAt: last?.createdAt ?? null, now });
}

export interface CheckinWithUser {
  id: string;
  userId: string;
  userName: string | null;
  helped: string | null;
  annoyed: string | null;
  missing: string | null;
  createdAt: Date;
}

/** Answered check-ins (not dismissals), newest first; optionally one team's. Admin only. */
export async function listCheckins(
  opts: { teamId?: string; limit?: number } = {},
): Promise<CheckinWithUser[]> {
  return getDb()
    .select({
      id: pilotCheckins.id,
      userId: pilotCheckins.userId,
      userName: users.name,
      helped: pilotCheckins.helped,
      annoyed: pilotCheckins.annoyed,
      missing: pilotCheckins.missing,
      createdAt: pilotCheckins.createdAt,
    })
    .from(pilotCheckins)
    .leftJoin(users, eq(pilotCheckins.userId, users.id))
    .where(and(eq(pilotCheckins.dismissed, false), inTeam(pilotCheckins.userId, opts.teamId)))
    .orderBy(desc(pilotCheckins.createdAt))
    .limit(Math.min(opts.limit ?? 50, 500))
    .all();
}

/** Per tool: uses, thumbs, time saved, quality and comments; optionally one team's. */
export async function pilotOverview(opts: { teamId?: string }): Promise<ToolSummary[]> {
  const db = getDb();
  const uses = db
    .select({ toolSlug: generations.toolSlug, count: sql<number>`count(*)` })
    .from(generations)
    .where(inTeam(generations.userId, opts.teamId))
    .groupBy(generations.toolSlug)
    .all();
  const rated = db
    .select({
      toolSlug: generations.toolSlug,
      rating: feedback.rating,
      minutesSaved: feedback.minutesSaved,
      quality: feedback.quality,
      comment: feedback.comment,
    })
    .from(feedback)
    .innerJoin(generations, eq(feedback.generationId, generations.id))
    .where(inTeam(feedback.userId, opts.teamId))
    .all();
  return summarizeByTool(uses, rated);
}

/** Remove all check-ins of a user (delete-my-data cascade). */
export async function deleteCheckinsForUser(userId: string): Promise<void> {
  getDb().delete(pilotCheckins).where(eq(pilotCheckins.userId, userId)).run();
}
