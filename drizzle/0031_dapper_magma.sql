CREATE TABLE `ai_usage_rollup` (
	`id` text PRIMARY KEY NOT NULL,
	`month` text NOT NULL,
	`team_id` text NOT NULL,
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
	`reasoning_tokens` integer DEFAULT 0 NOT NULL,
	`cost_micros` integer DEFAULT 0 NOT NULL,
	`unpriced_calls` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_usage_rollup_key` ON `ai_usage_rollup` (`month`,`team_id`,`source`,`model`);