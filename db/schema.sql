-- Education Life Center USA — full D1 schema (port, 2026-11-13).
-- Concatenation of migrations 0001-0015, in order. Paste this whole file
-- into the Cloudflare D1 console for the education-life-center-usa
-- database and run it ONCE on the empty database. Then run db/seed-jobs.sql.

-- ===== migrations/0001_initial.sql =====
CREATE TABLE entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- ===== migrations/0002_membership_platform_tables.sql =====
DROP TABLE IF EXISTS entries;
CREATE TABLE members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Oklahoma City',
  state TEXT NOT NULL DEFAULT 'OK',
  tier TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  referral_code TEXT NOT NULL UNIQUE,
  referred_by_code TEXT,
  free_years_earned INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE children (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES members(id),
  name TEXT NOT NULL,
  birth_year INTEGER NOT NULL,
  school_level TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE member_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL UNIQUE REFERENCES members(id),
  card_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  issued_at INTEGER NOT NULL
);
CREATE TABLE applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES members(id),
  service TEXT NOT NULL,
  amount REAL,
  purpose TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  partner TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'received',
  decision TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES members(id),
  invoice_number TEXT NOT NULL UNIQUE,
  period_label TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'due_at_launch',
  created_at INTEGER NOT NULL
);
CREATE TABLE job_listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employer_name TEXT NOT NULL,
  title TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT 'Oklahoma City, OK',
  pay_range TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL
);
CREATE TABLE job_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES members(id),
  listing_id INTEGER NOT NULL REFERENCES job_listings(id),
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'sent_to_employer',
  created_at INTEGER NOT NULL
);
CREATE TABLE automation_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER REFERENCES members(id),
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- ===== migrations/0003_partners_and_fintech_payments.sql =====
CREATE TABLE partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_name TEXT NOT NULL,
  partner_type TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT 'Oklahoma City',
  services_interest TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'interest_registered',
  created_at INTEGER NOT NULL
);
CREATE TABLE payment_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL UNIQUE REFERENCES members(id),
  method TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'Fintech payment provider',
  last4 TEXT NOT NULL,
  auto_renew INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES members(id),
  invoice_id INTEGER NOT NULL REFERENCES invoices(id),
  amount REAL NOT NULL,
  method TEXT NOT NULL,
  provider TEXT NOT NULL,
  receipt_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'confirmed',
  created_at INTEGER NOT NULL
);

-- ===== migrations/0004_add_529_access_plans.sql =====
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

-- ===== migrations/0005_add_529_cases.sql =====
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

-- ===== migrations/0006_add_membership_waitlist.sql =====
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

-- ===== migrations/0007_add_member_access_key_hash.sql =====
ALTER TABLE `members` ADD COLUMN `access_key_hash` text;

-- ===== migrations/0008_add_guided_withdrawal_sittings.sql =====
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
CREATE UNIQUE INDEX `withdrawal_sittings_sitting_number_unique` ON `withdrawal_sittings` (`sitting_number`);

-- ===== migrations/0009_withdrawal_fee_199_default.sql =====
-- Founder fee ruling (2026-11-12): the Guided Withdrawal sitting fee is
-- now $199 flat per completed sitting (was $99). The 529 case pricing is
-- unchanged: $99 founding for the first 50 completed cases, then $149.
--
-- No table change is needed: startWithdrawalSitting always writes the
-- current WITHDRAWAL_FEE explicitly into fee_amount at booking, so the
-- column default is never relied on, and sittings already booked keep
-- the price they booked with. This statement is an intentional no-op
-- that records the ruling in the migration history.
UPDATE `withdrawal_sittings` SET `fee_amount` = `fee_amount` WHERE 0;

-- ===== migrations/0010_add_journeys_door_progress_email_reports.sql =====
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

-- ===== migrations/0011_add_invoice_payment_reference.sql =====
ALTER TABLE `invoices` ADD COLUMN `payment_reference` text DEFAULT '' NOT NULL;

-- ===== migrations/0012_add_job_listing_research_fields.sql =====
ALTER TABLE `job_listings` ADD COLUMN `apply_url` text DEFAULT '' NOT NULL;
ALTER TABLE `job_listings` ADD COLUMN `employment_type` text DEFAULT '' NOT NULL;
ALTER TABLE `job_listings` ADD COLUMN `requirements` text DEFAULT '' NOT NULL;
ALTER TABLE `job_listings` ADD COLUMN `deadline` text DEFAULT '' NOT NULL;
ALTER TABLE `job_listings` ADD COLUMN `verified_date` text DEFAULT '' NOT NULL;

-- ===== migrations/0013_add_site_settings.sql =====
CREATE TABLE `site_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);

-- ===== migrations/0014_seed_admin_code_hash.sql =====
SELECT 1;

-- ===== migrations/0015_admin_code_pbkdf2_verifier.sql =====
INSERT OR IGNORE INTO `site_settings` (`key`, `value`, `updated_at`) VALUES ('admin_code_hash', 'pbkdf2-sha256$600000$25234e90138d53360fd84b118b985b39$325bd6ae781f9b81c1c2edc0b73d71bbbbe4aef34d0004a94a864a741adb4388', 1794600000000);
UPDATE `site_settings` SET `value` = 'pbkdf2-sha256$600000$25234e90138d53360fd84b118b985b39$325bd6ae781f9b81c1c2edc0b73d71bbbbe4aef34d0004a94a864a741adb4388', `updated_at` = 1794600000000 WHERE `key` = 'admin_code_hash';


-- ===== migrations/0016_visits_counter.sql =====
CREATE TABLE `visits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`path` text,
	`country` text,
	`created_at` text NOT NULL
);
