CREATE TABLE `divisions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `programmes` ADD `division_id` text;--> statement-breakpoint
CREATE INDEX `programmes_division_idx` ON `programmes` (`division_id`);