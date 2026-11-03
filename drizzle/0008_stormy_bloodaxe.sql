-- P17 (BESLUIT-2026-11-03-3): permanently remove student accounts and their data.
DELETE FROM `messages` WHERE `session_id` IN (SELECT `id` FROM `chat_sessions` WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `role` = 'student'));--> statement-breakpoint
DELETE FROM `chat_sessions` WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `role` = 'student');--> statement-breakpoint
DELETE FROM `generations` WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `role` = 'student');--> statement-breakpoint
DELETE FROM `feedback` WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `role` = 'student');--> statement-breakpoint
DELETE FROM `usage` WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `role` = 'student');--> statement-breakpoint
DELETE FROM `context_profiles` WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `role` = 'student');--> statement-breakpoint
DELETE FROM `projects` WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `role` = 'student');--> statement-breakpoint
DELETE FROM `password_resets` WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `role` = 'student');--> statement-breakpoint
DELETE FROM `instance_settings` WHERE substr(`key`, instr(`key`, ':') + 1) IN (SELECT `id` FROM `users` WHERE `role` = 'student');--> statement-breakpoint
DELETE FROM `invites` WHERE `role` = 'student' OR `cohort_id` IS NOT NULL OR `used_by_user_id` IN (SELECT `id` FROM `users` WHERE `role` = 'student');--> statement-breakpoint
DELETE FROM `users` WHERE `role` = 'student';--> statement-breakpoint
DROP TABLE `cohort_memberships`;--> statement-breakpoint
DROP TABLE `cohort_teachers`;--> statement-breakpoint
DROP TABLE `cohorts`;--> statement-breakpoint
DROP TABLE `session_summaries`;--> statement-breakpoint
ALTER TABLE `chat_sessions` DROP COLUMN `cohort_id`;--> statement-breakpoint
ALTER TABLE `invites` DROP COLUMN `cohort_id`;--> statement-breakpoint
ALTER TABLE `invites` DROP COLUMN `email`;--> statement-breakpoint
ALTER TABLE `tool_settings` DROP COLUMN `audience_override`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `disabled_at`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `deletion_requested_at`;