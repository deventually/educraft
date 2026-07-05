CREATE TABLE `cohort_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`cohort_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `membership_cohort_user` ON `cohort_memberships` (`cohort_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `cohorts` (
	`id` text PRIMARY KEY NOT NULL,
	`created_by_user_id` text NOT NULL,
	`name` text NOT NULL,
	`allowed_tool_slugs` text NOT NULL,
	`config_json` text DEFAULT '{}' NOT NULL,
	`context_profile_id` text,
	`active_until` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `chat_sessions` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `chat_sessions` ADD `cohort_id` text;--> statement-breakpoint
ALTER TABLE `invites` ADD `created_by_user_id` text;--> statement-breakpoint
ALTER TABLE `invites` ADD `cohort_id` text;--> statement-breakpoint
ALTER TABLE `invites` ADD `email` text;--> statement-breakpoint
ALTER TABLE `users` ADD `session_version` integer DEFAULT 0 NOT NULL;