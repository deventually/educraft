import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * A teacher's internship or thesis track for one student (P38), under a code, never a name.
 * Owner-only and never shared; wiped by `trackRetention.server.ts` once `purgeAfter` has
 * passed (set when the track closes). Re-exported by `schema.server.ts`.
 */
export const supervisionTracks = sqliteTable(
  "supervision_tracks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    code: text("code").notNull(),
    kind: text("kind").notNull(), // "internship" | "thesis"
    courseId: text("course_id"),
    assessmentModelId: text("assessment_model_id"),
    dataJson: text("data_json").notNull(), // TrackDataSchema: milestone status, hand-in dates
    closedAt: integer("closed_at", { mode: "timestamp_ms" }),
    purgeAfter: integer("purge_after", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("supervision_tracks_user_idx").on(t.userId),
    index("supervision_tracks_purge_idx").on(t.purgeAfter),
  ],
);

/** One round of a track: the redacted text that went to the AI and the feedback on it. */
export const trackRounds = sqliteTable(
  "track_rounds",
  {
    id: text("id").primaryKey(),
    trackId: text("track_id").notNull(),
    milestone: text("milestone").notNull(),
    round: integer("round").notNull(),
    redactedText: text("redacted_text").notNull(),
    feedbackJson: text("feedback_json").notNull(), // RoundFeedbackSchema
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("track_rounds_track_idx").on(t.trackId)],
);
