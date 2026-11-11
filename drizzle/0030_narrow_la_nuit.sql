ALTER TABLE `ai_usage` ADD `cost_micros` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_usage` ADD `unpriced_calls` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `ai_usage` SET `unpriced_calls` = `calls`;