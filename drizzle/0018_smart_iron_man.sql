CREATE TABLE `agent_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`course_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`model` text NOT NULL,
	`findings_json` text NOT NULL,
	`course_updated_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `agent_reviews_user_course_idx` ON `agent_reviews` (`user_id`,`course_id`);--> statement-breakpoint
CREATE TABLE `review_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`review_id` text NOT NULL,
	`finding_id` text NOT NULL,
	`decision` text NOT NULL,
	`reason` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_decisions_review_finding` ON `review_decisions` (`review_id`,`finding_id`);