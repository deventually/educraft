CREATE TABLE `session_summaries` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`user_id` text NOT NULL,
	`cohort_id` text,
	`tool_slug` text NOT NULL,
	`summary_json` text NOT NULL,
	`helpfulness` integer,
	`created_at` integer NOT NULL
);
