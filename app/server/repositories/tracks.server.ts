/**
 * A teacher's internship and thesis tracks (P38). Repository rule: async, every query scoped
 * to the owning `userId` (a round through its track), every write re-parsed with the track's
 * schemas. A track is never shared (not in `shares.server.ts`). Wiping removes the rounds with
 * the track; `purgeExpiredTracks` is the one call without an owner, for the retention task.
 */
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNotNull, lte, max } from "drizzle-orm";
import { getDb } from "../db.server";
import { supervisionTracks, trackRounds } from "../schema.server";
import {
  type MilestoneId,
  purgeDate,
  type RoundFeedback,
  RoundFeedbackSchema,
  type RoundInput,
  RoundInputSchema,
  type TrackData,
  TrackDataSchema,
  type TrackInput,
  TrackInputSchema,
} from "~/lib/tracks";
import { getAssessmentModel } from "./assessmentModels.server";
import { getCourse } from "./courses.server";
import { getTrackRetentionDays } from "./settings.server";

export interface Track {
  id: string;
  code: string;
  kind: "internship" | "thesis";
  courseId: string | null;
  assessmentModelId: string | null;
  data: TrackData;
  closedAt: Date | null;
  purgeAfter: Date | null;
  createdAt: Date;
}

export interface TrackRound {
  id: string;
  trackId: string;
  milestone: MilestoneId;
  round: number;
  redactedText: string;
  feedback: RoundFeedback;
  createdAt: Date;
}

type TrackRow = typeof supervisionTracks.$inferSelect;

const rowToTrack = (row: TrackRow): Track => ({
  id: row.id,
  code: row.code,
  kind: row.kind === "thesis" ? "thesis" : "internship",
  courseId: row.courseId,
  assessmentModelId: row.assessmentModelId,
  data: TrackDataSchema.parse(JSON.parse(row.dataJson)),
  closedAt: row.closedAt,
  purgeAfter: row.purgeAfter,
  createdAt: row.createdAt,
});

const ownTrack = (userId: string, id: string) =>
  and(eq(supervisionTracks.id, id), eq(supervisionTracks.userId, userId));

function getRow(userId: string, id: string): TrackRow | undefined {
  return getDb().select().from(supervisionTracks).where(ownTrack(userId, id)).get();
}

export async function listTracks(userId: string, limit?: number): Promise<Track[]> {
  return getDb()
    .select()
    .from(supervisionTracks)
    .where(eq(supervisionTracks.userId, userId))
    .orderBy(desc(supervisionTracks.createdAt))
    .limit(Math.min(limit ?? 50, 500))
    .all()
    .map(rowToTrack);
}

export async function getTrack(userId: string, id: string): Promise<Track | null> {
  const row = getRow(userId, id);
  return row ? rowToTrack(row) : null;
}

/** A new open track; null when the course or assessment model is not the caller's. */
export async function createTrack(userId: string, input: TrackInput): Promise<Track | null> {
  const parsed = TrackInputSchema.parse(input);
  if (parsed.courseId && !(await getCourse(userId, parsed.courseId))) return null;
  if (parsed.assessmentModelId && !(await getAssessmentModel(userId, parsed.assessmentModelId)))
    return null;
  const row: TrackRow = {
    id: randomUUID(),
    userId,
    ...parsed,
    dataJson: JSON.stringify(TrackDataSchema.parse({})),
    closedAt: null,
    purgeAfter: null,
    createdAt: new Date(),
  };
  getDb().insert(supervisionTracks).values(row).run();
  return rowToTrack(row);
}

export async function updateTrackData(
  userId: string,
  id: string,
  data: TrackData,
): Promise<Track | null> {
  const dataJson = JSON.stringify(TrackDataSchema.parse(data));
  getDb().update(supervisionTracks).set({ dataJson }).where(ownTrack(userId, id)).run();
  return getTrack(userId, id);
}

/** Close a track: it is wiped the admin's retention days after `now`. */
export async function closeTrack(
  userId: string,
  id: string,
  now = new Date(),
): Promise<Track | null> {
  if (!getRow(userId, id)) return null;
  const purgeAfter = purgeDate(now, await getTrackRetentionDays());
  getDb()
    .update(supervisionTracks)
    .set({ closedAt: now, purgeAfter })
    .where(ownTrack(userId, id))
    .run();
  return getTrack(userId, id);
}

/** "Wipe now": the track and its rounds; false when it is not the caller's. */
export async function deleteTrack(userId: string, id: string): Promise<boolean> {
  if (!getRow(userId, id)) return false;
  getDb().transaction((tx) => {
    tx.delete(trackRounds).where(eq(trackRounds.trackId, id)).run();
    tx.delete(supervisionTracks).where(ownTrack(userId, id)).run();
  });
  return true;
}

/** Add a round to one of the caller's tracks, numbered per milestone; null when not theirs. */
export async function addRound(
  userId: string,
  trackId: string,
  input: RoundInput,
): Promise<TrackRound | null> {
  const parsed = RoundInputSchema.parse(input);
  if (!getRow(userId, trackId)) return null;
  const db = getDb();
  const last = db
    .select({ round: max(trackRounds.round) })
    .from(trackRounds)
    .where(and(eq(trackRounds.trackId, trackId), eq(trackRounds.milestone, parsed.milestone)))
    .get();
  const round: TrackRound = {
    id: randomUUID(),
    trackId,
    milestone: parsed.milestone,
    round: (last?.round ?? 0) + 1,
    redactedText: parsed.redactedText,
    feedback: parsed.feedback,
    createdAt: new Date(),
  };
  db.insert(trackRounds)
    .values({ ...round, feedbackJson: JSON.stringify(round.feedback) })
    .run();
  return round;
}

/** The rounds of one of the caller's tracks, oldest first; empty when not theirs. */
export async function listRounds(userId: string, trackId: string): Promise<TrackRound[]> {
  if (!getRow(userId, trackId)) return [];
  return getDb()
    .select()
    .from(trackRounds)
    .where(eq(trackRounds.trackId, trackId))
    .orderBy(asc(trackRounds.createdAt), asc(trackRounds.milestone), asc(trackRounds.round))
    .limit(500)
    .all()
    .map((r) => ({
      id: r.id,
      trackId: r.trackId,
      milestone: RoundInputSchema.shape.milestone.parse(r.milestone),
      round: r.round,
      redactedText: r.redactedText,
      feedback: RoundFeedbackSchema.parse(JSON.parse(r.feedbackJson)),
      createdAt: r.createdAt,
    }));
}

/**
 * Wipe every track whose `purgeAfter` has passed, rounds included, in the current
 * institution's database (the retention task); how many tracks went.
 */
export async function purgeExpiredTracks(now: Date): Promise<number> {
  if (Number.isNaN(now.getTime())) throw new Error("Invalid date");
  const expired = and(
    isNotNull(supervisionTracks.purgeAfter),
    lte(supervisionTracks.purgeAfter, now),
  );
  return getDb().transaction((tx) => {
    const ids = tx.select({ id: supervisionTracks.id }).from(supervisionTracks).where(expired);
    tx.delete(trackRounds).where(inArray(trackRounds.trackId, ids)).run();
    return tx.delete(supervisionTracks).where(expired).run().changes;
  });
}
