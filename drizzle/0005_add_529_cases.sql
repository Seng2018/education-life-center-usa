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
