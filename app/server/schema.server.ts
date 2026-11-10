import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/sqlite-core";

/** An authenticated account. Created via invite link (see `invites`). */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // crypto.randomUUID()
  name: text("name").notNull(),
  email: text("email").unique(), // nullable; invites may be nameless
  passwordHash: text("password_hash").notNull(), // "scrypt:<saltHex>:<hashHex>"
  role: text("role").notNull().default("teacher"), // "teacher" | "admin"
  // Single active session (Phase 6 anti-sharing): bumped only on password change/reset and on
  // owner deactivation (P18.7), and carried in the session cookie; a stale cookie is treated as logged out.
  sessionVersion: integer("session_version").notNull().default(0),
  // P18: owner-set deactivation; null = active. (An earlier student-only column of the same
  // name was dropped in 0008.)
  disabledAt: integer("disabled_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/**
 * A single-use password-reset token. There is no email service, so an admin
 * mints one, shares the link out-of-band (like an invite), and the user opens it
 * to set a new password themselves. Deleted on use (single-use, like `revokeInvite`).
 */
export const passwordResets = sqliteTable("password_resets", {
  token: text("token").primaryKey(), // 32+ random bytes, base64url
  userId: text("user_id").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/** A single-use invitation token that mints an account with a preset role. */
export const invites = sqliteTable("invites", {
  token: text("token").primaryKey(), // 32+ random bytes, base64url
  role: text("role").notNull().default("teacher"),
  note: text("note"), // who this was for
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  usedByUserId: text("used_by_user_id"),
  // Who issued it. Nullable: role-only ops invites (scripts/invite.ts) carry none.
  createdByUserId: text("created_by_user_id"),
  // P28.2: the team the new account joins on redeem; null = no team.
  teamId: text("team_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/** A one-shot generation result (one row per produced artifact / stage). */
export const generations = sqliteTable(
  "generations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"), // owner; scoped in every repository query
    toolSlug: text("tool_slug").notNull(),
    stageId: text("stage_id"),
    model: text("model").notNull(),
    inputJson: text("input_json").notNull(),
    contextProfileId: text("context_profile_id"),
    outputLanguage: text("output_language").notNull().default("nl"),
    outputMarkdown: text("output_markdown").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  // Every query is owner-scoped and the history list orders by created_at.
  (t) => [index("generations_user_idx").on(t.userId, t.createdAt)],
);

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
    // Pilot: "how much time did this save?" (0/15/30/60, 60 = 60+) and quality 1-5.
    minutesSaved: integer("minutes_saved"),
    quality: integer("quality"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [uniqueIndex("feedback_user_generation").on(t.userId, t.generationId)],
);

/**
 * A teacher's periodic pilot check-in: what helped, what annoyed, what is missing.
 * `dismissed` rows ("not now") hold no answers; they only space out the next prompt.
 */
export const pilotCheckins = sqliteTable(
  "pilot_checkins",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    helped: text("helped"),
    annoyed: text("annoyed"),
    missing: text("missing"),
    dismissed: integer("dismissed", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("pilot_checkins_user_idx").on(t.userId, t.createdAt)],
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

/**
 * A BDB/BKE workplace dossier (brief P25). The whole dossier is one
 * Zod-validated JSON document (`DossierDataSchema`), edited as a whole, like a
 * context profile. Scoped to its owner.
 */
export const portfolioDossiers = sqliteTable("portfolio_dossiers", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  dataJson: text("data_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

/**
 * A saved rubric (brief P23.2): criteria × levels as one Zod-validated JSON document
 * (`RubricDataSchema`), edited as a whole, like a context profile. Scoped to its owner.
 */
export const rubrics = sqliteTable("rubrics", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  dataJson: text("data_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

/**
 * Closed rubric fill-ins (brief P23.3, BESLUIT-2026-11-04-8): only which level was chosen per
 * criterion (`levelsJson`, `RubricScoreSchema`) and the month of closing. On purpose there is no
 * column for a name, a student code, a comment or a date per fill-in. Scoped to its owner.
 */
export const rubricScores = sqliteTable(
  "rubric_scores",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    rubricId: text("rubric_id").notNull(),
    /** YYYY-MM */
    month: text("month").notNull(),
    levelsJson: text("levels_json").notNull(),
  },
  (t) => [index("rubric_scores_user_rubric_idx").on(t.userId, t.rubricId)],
);

/**
 * A teacher's course (brief P20): learning outcomes, activities and assessments as one
 * Zod-validated JSON document (`CourseDataSchema`), edited as a whole, like a context profile.
 * Scoped to its owner.
 */
export const courses = sqliteTable("courses", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  contextProfileId: text("context_profile_id"),
  dataJson: text("data_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

/**
 * A generation linked to a course (brief P20), optionally to one activity or assessment
 * (`itemId`, an id inside the course JSON). One link per (course, generation).
 */
export const courseLinks = sqliteTable(
  "course_links",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    courseId: text("course_id").notNull(),
    generationId: text("generation_id").notNull(),
    itemId: text("item_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    uniqueIndex("course_links_course_generation").on(t.courseId, t.generationId),
    index("course_links_user_idx").on(t.userId),
  ],
);

/**
 * One role-agent review of a course (brief P21, 21.3): the hat's findings as JSON, each with
 * a stable id (`f1`, `f2`, ...). `courseUpdatedAt` is the course's `updatedAt` at review time,
 * so the UI can say the review is out of date. Scoped to its owner.
 */
export const agentReviews = sqliteTable(
  "agent_reviews",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    courseId: text("course_id").notNull(),
    agentId: text("agent_id").notNull(),
    model: text("model").notNull(),
    findingsJson: text("findings_json").notNull(),
    courseUpdatedAt: integer("course_updated_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("agent_reviews_user_course_idx").on(t.userId, t.courseId)],
);

/**
 * The teacher's decision on one finding (brief P21): `accepted` | `rejected`, with an
 * optional reason. One decision per (review, finding); deciding again replaces it.
 */
export const reviewDecisions = sqliteTable(
  "review_decisions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    reviewId: text("review_id").notNull(),
    findingId: text("finding_id").notNull(),
    decision: text("decision").notNull(),
    reason: text("reason"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [uniqueIndex("review_decisions_review_finding").on(t.reviewId, t.findingId)],
);

/** A teacher's own choice of hats: `choice` "on" | "off" per agent. No row = the hat's default. */
export const agentChoices = sqliteTable(
  "agent_choices",
  {
    userId: text("user_id").notNull(),
    agentId: text("agent_id").notNull(),
    choice: text("choice").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.agentId] })],
);

/**
 * Per-tool instance configuration (Phase 4). One row per tool an admin has
 * touched; an absent row means "registry default" (safe defaults: a fresh
 * instance behaves exactly as before this phase).
 */
export const toolSettings = sqliteTable("tool_settings", {
  toolSlug: text("tool_slug").primaryKey(),
  // P28.3: the instance stand "off" | "on" | "request"; null = registry default
  // (`tool.enabled` → "on", else "off"). Replaces the boolean `enabled` (migration 0016).
  stand: text("stand"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

/**
 * Instance-wide key/value settings (Phase 4), e.g. `enabledModels`. The value is
 * JSON so a key can hold a list or object without a schema change. An absent key
 * means "default" (for enabledModels: the whole client-selectable catalog).
 */
export const instanceSettings = sqliteTable("instance_settings", {
  key: text("key").primaryKey(), // e.g. "enabledModels"
  valueJson: text("value_json").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

/** A team of colleagues (P28.2). Joining shares nothing; it is a group, not a role. */
export const teams = sqliteTable("teams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  // P28.3: the team's choices for features, tools and models (`TeamSettingsSchema`).
  settingsJson: text("settings_json").notNull().default("{}"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/**
 * Who is in which team (P28.2). `isLead` is a stand per team, not a role: `users.role`
 * stays `teacher | admin`. One row per (team, user).
 */
export const teamMembers = sqliteTable(
  "team_members",
  {
    teamId: text("team_id").notNull(),
    userId: text("user_id").notNull(),
    isLead: integer("is_lead", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.teamId, t.userId] }),
    index("team_members_user_idx").on(t.userId),
  ],
);

/**
 * A teacher's exception for one feature or tool (P28.3, admin only): `key` is
 * `feature:<id>` or `tool:<slug>`, `choice` is "on" or "off". No row = no exception.
 */
export const featureExceptions = sqliteTable(
  "feature_exceptions",
  {
    userId: text("user_id").notNull(),
    key: text("key").notNull(),
    choice: text("choice").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

/**
 * An item shared with a team (P28.4): `kind` is "course" | "rubric" | "contextProfile"
 * (`SHARE_KINDS`). Team-mates read and copy; only the owner writes. One row per
 * (kind, item, team). Leaving the team or removing it drops the row.
 */
export const shares = sqliteTable(
  "shares",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull(),
    kind: text("kind").notNull(),
    itemId: text("item_id").notNull(),
    teamId: text("team_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    uniqueIndex("shares_kind_item_team").on(t.kind, t.itemId, t.teamId),
    index("shares_team_idx").on(t.teamId),
  ],
);

/**
 * The admin audit log: one row per admin action that changes someone's access (a role, a
 * password, (de)activation, an account, an invite, the model choice). Ids only, no names: a
 * deleted account stays in the log as "deleted account". `detail` is a small JSON object of
 * facts (never a password, link or token). Append-only; read by admins on /admin/audit.
 */
export const adminAudit = sqliteTable(
  "admin_audit",
  {
    id: text("id").primaryKey(),
    at: integer("at", { mode: "timestamp_ms" }).notNull(),
    actorUserId: text("actor_user_id").notNull(),
    action: text("action").notNull(),
    targetUserId: text("target_user_id"),
    detail: text("detail"),
  },
  (t) => [index("admin_audit_at_idx").on(t.at)],
);

// Two-step verification (P2-12) lives in its own file; one schema for drizzle and the app.
export * from "./schemaAuth.server";

export type UserRow = typeof users.$inferSelect;
export type InviteRow = typeof invites.$inferSelect;
export type TeamRow = typeof teams.$inferSelect;
export type PasswordResetRow = typeof passwordResets.$inferSelect;
export type ToolSettingRow = typeof toolSettings.$inferSelect;
export type InstanceSettingRow = typeof instanceSettings.$inferSelect;
export type GenerationRow = typeof generations.$inferSelect;
export type ContextProfileRow = typeof contextProfiles.$inferSelect;
export type UsageRow = typeof usage.$inferSelect;
export type FeedbackRow = typeof feedback.$inferSelect;
export type PilotCheckinRow = typeof pilotCheckins.$inferSelect;
