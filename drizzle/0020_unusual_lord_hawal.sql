CREATE TABLE `pilot_checkins` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`helped` text,
	`annoyed` text,
	`missing` text,
	`dismissed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pilot_checkins_user_idx` ON `pilot_checkins` (`user_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `feedback` ADD `minutes_saved` integer;--> statement-breakpoint
ALTER TABLE `feedback` ADD `quality` integer;