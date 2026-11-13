CREATE TABLE `journeys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`journey_number` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
CREATE UNIQUE INDEX `journeys_journey_number_unique` ON `journeys` (`journey_number`);
CREATE UNIQUE INDEX `journeys_email_unique` ON `journeys` (`email`);
CREATE TABLE `door_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`journey_id` integer NOT NULL REFERENCES `journeys`(`id`),
	`door_id` text NOT NULL,
	`tier` text DEFAULT 'guided' NOT NULL,
	`status` text DEFAULT 'not_started' NOT NULL,
	`visited_at` integer,
	`completed_date` text DEFAULT '' NOT NULL,
	`completed_at` integer,
	`fee_amount` real DEFAULT 0 NOT NULL,
	`fee_status` text DEFAULT 'none' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
CREATE UNIQUE INDEX `door_progress_journey_door_unique` ON `door_progress` (`journey_id`, `door_id`);
CREATE TABLE `email_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`journey_id` integer REFERENCES `journeys`(`id`),
	`kind` text NOT NULL,
	`event` text NOT NULL,
	`recipient` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'recorded' NOT NULL,
	`created_at` integer NOT NULL
);
ALTER TABLE `invoices` ADD COLUMN `payment_reference` text DEFAULT '' NOT NULL;
ALTER TABLE `job_listings` ADD COLUMN `apply_url` text DEFAULT '' NOT NULL;
ALTER TABLE `job_listings` ADD COLUMN `employment_type` text DEFAULT '' NOT NULL;
ALTER TABLE `job_listings` ADD COLUMN `requirements` text DEFAULT '' NOT NULL;
ALTER TABLE `job_listings` ADD COLUMN `deadline` text DEFAULT '' NOT NULL;
ALTER TABLE `job_listings` ADD COLUMN `verified_date` text DEFAULT '' NOT NULL;
