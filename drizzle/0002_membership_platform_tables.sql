DROP TABLE IF EXISTS entries;
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE children (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES members(id),
  name TEXT NOT NULL,
  birth_year INTEGER NOT NULL,
  school_level TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE member_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL UNIQUE REFERENCES members(id),
  card_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  issued_at INTEGER NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES members(id),
  invoice_number TEXT NOT NULL UNIQUE,
  period_label TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'due_at_launch',
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE job_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES members(id),
  listing_id INTEGER NOT NULL REFERENCES job_listings(id),
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'sent_to_employer',
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE automation_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER REFERENCES members(id),
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
