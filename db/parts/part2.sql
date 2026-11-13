CREATE TABLE plans_529 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES members(id),
  child_name TEXT NOT NULL,
  plan_choice TEXT NOT NULL DEFAULT 'undecided',
  goal_amount REAL NOT NULL DEFAULT 0,
  monthly_contribution REAL NOT NULL DEFAULT 0,
  current_saved REAL NOT NULL DEFAULT 0,
  target_year INTEGER NOT NULL DEFAULT 2040,
  status TEXT NOT NULL DEFAULT 'planning',
  reminders_on INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE cases_529 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_number TEXT NOT NULL UNIQUE,
  parent_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT 'Oklahoma City',
  child_name TEXT NOT NULL,
  plan_choice TEXT NOT NULL DEFAULT 'undecided',
  goal_amount REAL NOT NULL DEFAULT 0,
  monthly_contribution REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'requested',
  fee_status TEXT NOT NULL DEFAULT 'due_on_success',
  fee_amount REAL NOT NULL DEFAULT 99,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
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
CREATE UNIQUE INDEX `membership_waitlist_email_unique` ON `membership_waitlist` (`email`);
