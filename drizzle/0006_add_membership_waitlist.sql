CREATE TABLE `membership_waitlist` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`full_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`city` text DEFAULT 'Oklahoma City' NOT NULL,
	`interested_tier` text,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `membership_waitlist_email_unique` ON `membership_waitlist` (`email`);
