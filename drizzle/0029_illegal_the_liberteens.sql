CREATE TABLE `ai_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`source` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`calls` integer DEFAULT 0 NOT NULL,
	`failed_calls` integer DEFAULT 0 NOT NULL,
	`unmetered_calls` integer DEFAULT 0 NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`cache_read_tokens` integer DEFAULT 0 NOT NULL,
	`cache_write_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`reasoning_tokens` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_usage_key` ON `ai_usage` (`user_id`,`day`,`source`,`model`);