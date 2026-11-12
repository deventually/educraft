CREATE TABLE `learning_line_programmes` (
	`line_id` text NOT NULL,
	`programme_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`line_id`, `programme_id`)
);
--> statement-breakpoint
CREATE INDEX `learning_line_programmes_programme_idx` ON `learning_line_programmes` (`programme_id`);