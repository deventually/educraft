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
