CREATE TABLE `cohort_teachers` (
	`id` text PRIMARY KEY NOT NULL,
	`cohort_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cohort_teacher_cohort_user` ON `cohort_teachers` (`cohort_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `instance_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tool_settings` (
	`tool_slug` text PRIMARY KEY NOT NULL,
	`enabled` integer,
	`audience_override` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `invites` ADD `allowed_tool_slugs` text;--> statement-breakpoint
ALTER TABLE `users` ADD `allowed_tool_slugs` text;