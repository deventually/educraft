CREATE TABLE `shares` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`kind` text NOT NULL,
	`item_id` text NOT NULL,
	`team_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shares_kind_item_team` ON `shares` (`kind`,`item_id`,`team_id`);--> statement-breakpoint
CREATE INDEX `shares_team_idx` ON `shares` (`team_id`);