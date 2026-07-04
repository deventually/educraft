import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

/** An authenticated account. Created via invite link (see `invites`). */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // crypto.randomUUID()
  name: text("name").notNull(),
  email: text("email").unique(), // nullable; invites may be nameless
  passwordHash: text("password_hash").notNull(), // "scrypt:<saltHex>:<hashHex>"
  role: text("role").notNull().default("teacher"), // "student" | "teacher" | "admin"
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/** A single-use invitation token that mints an account with a preset role. */
export const invites = sqliteTable("invites", {
  token: text("token").primaryKey(), // 32+ random bytes, base64url
  role: text("role").notNull().default("teacher"),
  note: text("note"), // who this was for
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  usedByUserId: text("used_by_user_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/** A saved piece of work grouping generations and chat sessions. */
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  userId: text("user_id"), // nullable now; non-breaking path to multi-user later
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/** A one-shot generation result (one row per produced artifact / stage). */
export const generations = sqliteTable("generations", {
  id: text("id").primaryKey(),
  userId: text("user_id"), // owner; scoped in every repository query
  projectId: text("project_id"),
  toolSlug: text("tool_slug").notNull(),
  stageId: text("stage_id"),
  model: text("model").notNull(),
  inputJson: text("input_json").notNull(),
  contextProfileId: text("context_profile_id"),
  outputLanguage: text("output_language").notNull().default("nl"),
  outputMarkdown: text("output_markdown").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/** A multi-turn chat session (Phase 3 tools). */
export const chatSessions = sqliteTable("chat_sessions", {
  id: text("id").primaryKey(),
  projectId: text("project_id"),
  toolSlug: text("tool_slug").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  model: text("model").notNull(),
  contextProfileId: text("context_profile_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  role: text("role").notNull(), // "user" | "assistant"
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/**
 * Per-user daily usage counters backing the request/token quota. One row per
 * (userId, day) — upserted on each completed generation. `day` is a UTC date
 * string ("2026-07-03") so a rollover simply lands on a fresh row.
 */
export const usage = sqliteTable(
  "usage",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    day: text("day").notNull(),
    requests: integer("requests").notNull().default(0),
    outputChars: integer("output_chars").notNull().default(0),
    // Nullable until the adapter surfaces token usage (logged as chars for now).
    outputTokens: integer("output_tokens"),
  },
  (t) => [uniqueIndex("usage_user_day").on(t.userId, t.day)],
);

/**
 * Structured tester feedback on a generation. One row per (userId, generationId)
 * — re-rating updates in place rather than duplicating.
 */
export const feedback = sqliteTable(
  "feedback",
  {
    id: text("id").primaryKey(),
    generationId: text("generation_id").notNull(),
    userId: text("user_id").notNull(),
    rating: integer("rating").notNull(), // +1 / -1
    comment: text("comment"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [uniqueIndex("feedback_user_generation").on(t.userId, t.generationId)],
);

/** A reusable HBO-i context profile. */
export const contextProfiles = sqliteTable("context_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  name: text("name").notNull(),
  dataJson: text("data_json").notNull(),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export type UserRow = typeof users.$inferSelect;
export type InviteRow = typeof invites.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
export type GenerationRow = typeof generations.$inferSelect;
export type ChatSessionRow = typeof chatSessions.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type ContextProfileRow = typeof contextProfiles.$inferSelect;
export type UsageRow = typeof usage.$inferSelect;
export type FeedbackRow = typeof feedback.$inferSelect;
