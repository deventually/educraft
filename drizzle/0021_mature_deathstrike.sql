CREATE TABLE `admin_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`at` integer NOT NULL,
	`actor_user_id` text NOT NULL,
	`action` text NOT NULL,
	`target_user_id` text,
	`detail` text
);
--> statement-breakpoint
CREATE INDEX `admin_audit_at_idx` ON `admin_audit` (`at`);