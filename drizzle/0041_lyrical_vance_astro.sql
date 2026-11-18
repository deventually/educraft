CREATE TABLE `privacy_gate_counts` (
	`day` text NOT NULL,
	`kind` text NOT NULL,
	`count` integer NOT NULL,
	PRIMARY KEY(`day`, `kind`)
);
--> statement-breakpoint
CREATE TABLE `privacy_shared_keep_words` (
	`word` text PRIMARY KEY NOT NULL,
	`shown` text NOT NULL,
	`added_by` text NOT NULL,
	`created_at` integer NOT NULL
);
