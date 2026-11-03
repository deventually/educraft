-- P18 (BESLUIT-2026-11-03-15, -17): drop retired per-teacher access keys and open admin invites.
DELETE FROM `instance_settings` WHERE `key` = 'enabledCountries' OR `key` LIKE 'assignedCountries:%' OR `key` LIKE 'assignedSectors:%' OR `key` LIKE 'assignedDomains:%' OR `key` LIKE 'contextCustomAccess:%';--> statement-breakpoint
DELETE FROM `invites` WHERE `role` <> 'teacher' AND `used_by_user_id` IS NULL;--> statement-breakpoint
DROP TABLE `chat_sessions`;--> statement-breakpoint
DROP TABLE `messages`;--> statement-breakpoint
DROP TABLE `projects`;--> statement-breakpoint
ALTER TABLE `generations` DROP COLUMN `project_id`;--> statement-breakpoint
ALTER TABLE `invites` DROP COLUMN `allowed_tool_slugs`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `allowed_tool_slugs`;