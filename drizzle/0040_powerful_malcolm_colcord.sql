CREATE TABLE `privacy_keep_words` (
	`user_id` text NOT NULL,
	`word` text NOT NULL,
	`shown` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `word`)
);
