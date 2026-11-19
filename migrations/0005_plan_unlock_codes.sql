-- 0005_plan_unlock_codes
CREATE TABLE IF NOT EXISTS unlock_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL,
  note TEXT,
  issuedByHouseholdId INTEGER NOT NULL REFERENCES settings(id),
  redeemedByHouseholdId INTEGER REFERENCES settings(id),
  redeemedAt TEXT,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS codes_code ON unlock_codes (code);
