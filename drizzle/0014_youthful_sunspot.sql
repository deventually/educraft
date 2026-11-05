CREATE TABLE `course_links` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`course_id` text NOT NULL,
	`generation_id` text NOT NULL,
	`item_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_links_course_generation` ON `course_links` (`course_id`,`generation_id`);--> statement-breakpoint
CREATE INDEX `course_links_user_idx` ON `course_links` (`user_id`);--> statement-breakpoint
CREATE TABLE `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`context_profile_id` text,
	`data_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
