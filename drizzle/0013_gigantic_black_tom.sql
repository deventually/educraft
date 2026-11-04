CREATE TABLE `rubric_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`rubric_id` text NOT NULL,
	`month` text NOT NULL,
	`levels_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rubric_scores_user_rubric_idx` ON `rubric_scores` (`user_id`,`rubric_id`);