CREATE TABLE `slide_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_kind` text NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`data` blob NOT NULL,
	`size` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `slide_templates_owner_idx` ON `slide_templates` (`owner_kind`,`owner_id`);