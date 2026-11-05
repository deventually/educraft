CREATE TABLE `feature_exceptions` (
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`choice` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `key`)
);
--> statement-breakpoint
ALTER TABLE `teams` ADD `settings_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `tool_settings` ADD `stand` text;--> statement-breakpoint
UPDATE `tool_settings` SET `stand` = CASE `enabled` WHEN 0 THEN 'off' WHEN 1 THEN 'on' ELSE NULL END;--> statement-breakpoint
INSERT INTO `feature_exceptions` (`user_id`, `key`, `choice`, `updated_at`) SELECT substr(`key`, 18), 'feature:portfolio', CASE `value_json` WHEN 'true' THEN 'on' ELSE 'off' END, `updated_at` FROM `instance_settings` WHERE `key` LIKE 'portfolioEnabled:%';--> statement-breakpoint
DELETE FROM `instance_settings` WHERE `key` LIKE 'portfolioEnabled:%';
