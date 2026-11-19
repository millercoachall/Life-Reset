-- 0001_initial: settings table (one row per household) + members + sessions
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  householdName TEXT NOT NULL DEFAULT 'Our Household',
  planTier TEXT NOT NULL DEFAULT 'free',
  joinCode TEXT UNIQUE,
  squareEssentialsUrl TEXT,
  squareCompleteUrl TEXT,
  squareVipUrl TEXT,
  isSeller INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS settings_joinCode_lower ON settings (lower(joinCode)) WHERE joinCode IS NOT NULL;

CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  householdId INTEGER NOT NULL REFERENCES settings(id),
  name TEXT NOT NULL,
  username TEXT UNIQUE,
  pinHash TEXT,
  pinSalt TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  createdAt TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS members_username_lower ON members (lower(username)) WHERE username IS NOT NULL;

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  memberId INTEGER NOT NULL REFERENCES members(id),
  householdId INTEGER NOT NULL REFERENCES settings(id),
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL
);
