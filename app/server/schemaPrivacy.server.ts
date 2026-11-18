import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * A teacher's never-list (anonymiseerpoort PR 3, BESLUIT-2026-11-17-6): words the live preview
 * and the gate never replace for them ("Bloom", a lone "Visser"). Only words, never a pattern
 * such as an e-mail address or a number. `word` is stored lower-case, so one entry per word;
 * `shown` keeps the teacher's spelling. Re-exported by `schema.server.ts`.
 */
export const privacyKeepWords = sqliteTable(
  "privacy_keep_words",
  {
    userId: text("user_id").notNull(),
    word: text("word").notNull(),
    shown: text("shown").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.word] })],
);

/**
 * The institution's never-list (anonymiseerpoort PR 5): words an admin keeps for everyone, picked
 * from what teachers put on their own list. Never a user's full name. `word` is lower-case, one
 * entry per word; `shown` keeps the spelling.
 */
export const privacySharedKeepWords = sqliteTable("privacy_shared_keep_words", {
  word: text("word").primaryKey(),
  shown: text("shown").notNull(),
  addedBy: text("added_by").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/**
 * The gate's counters (anonymiseerpoort PR 5), per UTC day: per kind how often it found something
 * (`teacher`, `colleague`, `email` …), plus `call` (calls through the gate) and `stopped` (calls
 * it held back to ask the teacher). Counts only, never a word; kept for a short while.
 */
export const privacyGateCounts = sqliteTable(
  "privacy_gate_counts",
  {
    day: text("day").notNull(),
    kind: text("kind").notNull(),
    count: integer("count").notNull(),
  },
  (t) => [primaryKey({ columns: [t.day, t.kind] })],
);
