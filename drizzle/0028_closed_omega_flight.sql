CREATE TABLE `learning_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`programme_id` text NOT NULL,
	`name` text NOT NULL,
	`course_ids_json` text DEFAULT '[]' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `learning_lines_programme_idx` ON `learning_lines` (`programme_id`);