-- 0002_life_reset_core_tables: tasks, brain_dumps, bills
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  householdId INTEGER NOT NULL REFERENCES settings(id),
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  priority TEXT NOT NULL DEFAULT 'medium',
  estMinutes INTEGER,
  waitingOn TEXT,
  notes TEXT,
  dueDate TEXT,
  assigneeMemberId INTEGER REFERENCES members(id),
  pinned INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  completedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS tasks_household ON tasks (householdId);

CREATE TABLE IF NOT EXISTS brain_dumps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  householdId INTEGER NOT NULL REFERENCES settings(id),
  rawText TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unsorted',
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS dumps_household ON brain_dumps (householdId);

CREATE TABLE IF NOT EXISTS bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  householdId INTEGER NOT NULL REFERENCES settings(id),
  name TEXT NOT NULL,
  amountCents INTEGER,
  dueDate TEXT,
  paid INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS bills_household ON bills (householdId);
