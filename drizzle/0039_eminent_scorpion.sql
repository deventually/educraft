CREATE TABLE `course_teams` (
	`course_id` text NOT NULL,
	`team_id` text NOT NULL,
	`role` text DEFAULT 'editor' NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`course_id`, `team_id`)
);
--> statement-breakpoint
CREATE INDEX `course_teams_team_idx` ON `course_teams` (`team_id`);