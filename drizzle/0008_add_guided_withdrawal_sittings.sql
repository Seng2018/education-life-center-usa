CREATE TABLE `withdrawal_sittings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sitting_number` text NOT NULL,
	`parent_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`city` text DEFAULT 'Oklahoma City' NOT NULL,
	`child_name` text NOT NULL,
	`plan_choice` text DEFAULT 'oklahoma_529' NOT NULL,
	`purpose` text DEFAULT 'college' NOT NULL,
	`is_member` integer DEFAULT 0 NOT NULL,
	`planned_amount` real DEFAULT 0 NOT NULL,
	`target_date` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`fee_status` text DEFAULT 'due_on_success' NOT NULL,
	`fee_amount` real DEFAULT 99 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `withdrawal_sittings_sitting_number_unique` ON `withdrawal_sittings` (`sitting_number`);
