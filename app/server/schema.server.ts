import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

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

/** A reusable HBO-i context profile. */
export const contextProfiles = sqliteTable("context_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  name: text("name").notNull(),
  dataJson: text("data_json").notNull(),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export type ProjectRow = typeof projects.$inferSelect;
export type GenerationRow = typeof generations.$inferSelect;
export type ChatSessionRow = typeof chatSessions.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type ContextProfileRow = typeof contextProfiles.$inferSelect;
