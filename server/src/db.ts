import { Database } from "bun:sqlite";
import { readdirSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const SQUARE_LINKS = {
  essentials: "https://square.link/u/OKktlhxo",
  complete: null,
  vip: null,
} as const;

export type PlanTier = "free" | "essentials" | "complete" | "vip";
export const TIER_RANK: Record<PlanTier, number> = {
  free: 0,
  essentials: 1,
  complete: 2,
  vip: 3,
};

const __dirname = dirname(fileURLToPath(import.meta.url));

export function dbPath(): string {
  return process.env.DB_PATH || join(__dirname, "..", "..", "data", "app.db");
}

let db: Database | null = null;

export function getDb(): Database {
  if (db) return db;
  const path = dbPath();
  mkdirSync(dirname(path), { recursive: true });
  db = new Database(path);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  migrate(db);
  seed(db);
  return db;
}

function migrate(db: Database) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, appliedAt TEXT NOT NULL)`
  );
  const dir = join(__dirname, "..", "..", "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const done = db
      .query("SELECT 1 FROM _migrations WHERE name = ?")
      .get(file);
    if (done) continue;
    const sql = readFileSync(join(dir, file), "utf-8");
    db.exec("BEGIN");
    try {
      db.exec(sql);
      db.query("INSERT INTO _migrations (name, appliedAt) VALUES (?, ?)").run(
        file,
        new Date().toISOString()
      );
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
}

function seed(db: Database) {
  const existing = db.query("SELECT id FROM settings WHERE id = 1").get() as
    | { id: number }
    | null;
  if (existing) return;
  db.query(
    `INSERT INTO settings (id, householdName, planTier, joinCode, squareEssentialsUrl, squareCompleteUrl, squareVipUrl, isSeller, createdAt)
     VALUES (1, 'Our Household', 'free', NULL, ?, ?, ?, 1, ?)`
  ).run(
    SQUARE_LINKS.essentials,
    SQUARE_LINKS.complete,
    SQUARE_LINKS.vip,
    new Date().toISOString()
  );
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
