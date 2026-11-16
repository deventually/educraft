CREATE TABLE `programme_teams` (
	`programme_id` text NOT NULL,
	`team_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`programme_id`, `team_id`)
);
--> statement-breakpoint
CREATE INDEX `programme_teams_team_idx` ON `programme_teams` (`team_id`);--> statement-breakpoint
INSERT INTO `programme_teams` (`programme_id`, `team_id`, `created_at`) SELECT `id`, `team_id`, `created_at` FROM `programmes`;--> statement-breakpoint
DROP INDEX `programmes_team_idx`;--> statement-breakpoint
ALTER TABLE `programmes` DROP COLUMN `team_id`;