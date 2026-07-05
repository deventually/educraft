import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

/** An authenticated account. Created via invite link (see `invites`). */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // crypto.randomUUID()
  name: text("name").notNull(),
  email: text("email").unique(), // nullable; invites may be nameless
  passwordHash: text("password_hash").notNull(), // "scrypt:<saltHex>:<hashHex>"
  role: text("role").notNull().default("teacher"), // "student" | "teacher" | "admin"
  // Single active session (Phase 6 anti-sharing): bumped on every login/redeem and
  // carried in the session cookie; a stale cookie is treated as logged out.
  sessionVersion: integer("session_version").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/** A single-use invitation token that mints an account with a preset role. */
export const invites = sqliteTable("invites", {
  token: text("token").primaryKey(), // 32+ random bytes, base64url
  role: text("role").notNull().default("teacher"),
  note: text("note"), // who this was for
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  usedByUserId: text("used_by_user_id"),
  // Provisioning (Phase 6): who issued it, which cohort the redeemer joins, and
  // the intended student's email (identity-bound invites — redemption must match).
  // All nullable: legacy role-only ops invites (scripts/invite.ts) carry none.
  createdByUserId: text("created_by_user_id"),
  cohortId: text("cohort_id"),
  email: text("email"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/**
 * A cohort (Phase 6) — the shared configuration a teacher provisions once: which
 * tutors are allowed, how each is configured, the context profile whose level is
 * injected for members, and an access window. Per-student invites are minted
 * against it; redeeming one joins the cohort. Intra-instance, not a tenant.
 */
export const cohorts = sqliteTable("cohorts", {
  id: text("id").primaryKey(),
  createdByUserId: text("created_by_user_id").notNull(), // teacher/mentor/admin
  name: text("name").notNull(), // "SE jaar 2 — 25/26 blok 1"
  allowedToolSlugs: text("allowed_tool_slugs").notNull(), // JSON string[] ⊆ userType:"student" slugs
  configJson: text("config_json").notNull().default("{}"), // { [slug]: { values: Record<string,string> } }
  contextProfileId: text("context_profile_id"), // teacher-owned profile → injected server-side for members
  activeUntil: integer("active_until", { mode: "timestamp_ms" }), // access window; null = open-ended
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/** A student ↔ cohort edge. One row per membership (join table leaves room for multi-cohort later). */
export const cohortMemberships = sqliteTable(
  "cohort_memberships",
  {
    id: text("id").primaryKey(),
    cohortId: text("cohort_id").notNull(),
    userId: text("user_id").notNull(), // the student
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [uniqueIndex("membership_cohort_user").on(t.cohortId, t.userId)],
);

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
  // Denormalised owner + cohort (Phase 6) — populated now so Phase 7's cohort
  // analytics need no re-migration.
  userId: text("user_id"),
  cohortId: text("cohort_id"),
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
 * De-personalised, per-session learning signal for the provisioning mentor
 * (Phase 7). One row per finished chat session — a post-session summariser pass
 * writes `summaryJson`, and the student may attach a `helpfulness` self-rating at
 * close. Privacy by construction: this is the ONLY mentor-facing view of a
 * session, and it carries derived signal about the *work*, never raw messages,
 * verbatim quotes, or personal disclosure (the summariser + a leakage guard
 * enforce that). Denormalised `userId`/`cohortId` let cohort rollups scope
 * without touching `messages`.
 */
export const sessionSummaries = sqliteTable("session_summaries", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(), // FK chat_sessions
  userId: text("user_id").notNull(), // the student (denormalised)
  cohortId: text("cohort_id"), // denormalised for rollups
  toolSlug: text("tool_slug").notNull(),
  // { topicsWorkedOn[], skillsProgressed[], misconceptions[] (about the material), effort }
  // — no quotes, no personal disclosure.
  summaryJson: text("summary_json").notNull(),
  // Optional student self-rating at close (−1/0/+1). The one signal the student chooses to share.
  helpfulness: integer("helpfulness"),
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
export type CohortRow = typeof cohorts.$inferSelect;
export type CohortMembershipRow = typeof cohortMemberships.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
export type GenerationRow = typeof generations.$inferSelect;
export type ChatSessionRow = typeof chatSessions.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type ContextProfileRow = typeof contextProfiles.$inferSelect;
export type UsageRow = typeof usage.$inferSelect;
export type FeedbackRow = typeof feedback.$inferSelect;
export type SessionSummaryRow = typeof sessionSummaries.$inferSelect;
