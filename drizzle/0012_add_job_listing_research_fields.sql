ALTER TABLE `job_listings` ADD COLUMN `apply_url` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `job_listings` ADD COLUMN `employment_type` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `job_listings` ADD COLUMN `requirements` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `job_listings` ADD COLUMN `deadline` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `job_listings` ADD COLUMN `verified_date` text DEFAULT '' NOT NULL;
