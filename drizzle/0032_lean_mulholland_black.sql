CREATE TABLE `announcement_dismissals` (
	`announcement_id` text NOT NULL,
	`user_id` text NOT NULL,
	`hidden_until` text,
	`dismissed_at` integer NOT NULL,
	PRIMARY KEY(`announcement_id`, `user_id`)
);
--> statement-breakpoint
CREATE INDEX `announcement_dismissals_user_idx` ON `announcement_dismissals` (`user_id`);--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`message` text NOT NULL,
	`level` text NOT NULL,
	`audience` text NOT NULL,
	`target_id` text,
	`ends_on` text,
	`remind_after_days` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `announcements_target_idx` ON `announcements` (`audience`,`target_id`);