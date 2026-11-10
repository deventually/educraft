CREATE TABLE `programme_courses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`programme_id` text NOT NULL,
	`course_id` text NOT NULL,
	`year` integer,
	`period` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `programme_courses_programme_course` ON `programme_courses` (`programme_id`,`course_id`);--> statement-breakpoint
CREATE INDEX `programme_courses_course_idx` ON `programme_courses` (`course_id`);--> statement-breakpoint
CREATE INDEX `programme_courses_user_idx` ON `programme_courses` (`user_id`);--> statement-breakpoint
CREATE TABLE `programmes` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`created_by` text NOT NULL,
	`name` text NOT NULL,
	`sector` text NOT NULL,
	`track` text,
	`form` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `programmes_team_idx` ON `programmes` (`team_id`);