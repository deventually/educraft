CREATE TABLE `agent_choices` (
	`user_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`choice` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `agent_id`)
);
