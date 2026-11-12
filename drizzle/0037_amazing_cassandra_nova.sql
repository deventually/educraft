CREATE TABLE `supervision_tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`code` text NOT NULL,
	`kind` text NOT NULL,
	`course_id` text,
	`assessment_model_id` text,
	`data_json` text NOT NULL,
	`closed_at` integer,
	`purge_after` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `supervision_tracks_user_idx` ON `supervision_tracks` (`user_id`);--> statement-breakpoint
CREATE INDEX `supervision_tracks_purge_idx` ON `supervision_tracks` (`purge_after`);--> statement-breakpoint
CREATE TABLE `track_rounds` (
	`id` text PRIMARY KEY NOT NULL,
	`track_id` text NOT NULL,
	`milestone` text NOT NULL,
	`round` integer NOT NULL,
	`redacted_text` text NOT NULL,
	`feedback_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `track_rounds_track_idx` ON `track_rounds` (`track_id`);