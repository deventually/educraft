CREATE TABLE `course_members` (
	`course_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'editor' NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`course_id`, `user_id`)
);
--> statement-breakpoint
CREATE INDEX `course_members_user_idx` ON `course_members` (`user_id`);