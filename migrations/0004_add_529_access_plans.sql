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
