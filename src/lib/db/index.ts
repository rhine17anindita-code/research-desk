import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { migrations } from "./migrations";
import { seedDefaults } from "./seed";

export type DB = Database.Database;

const globalForDb = globalThis as unknown as { __researchDb?: DB };

export function resolveDbPath(): string {
  const p = process.env.DATABASE_PATH?.trim();
  if (p) return path.resolve(p.startsWith("~/") ? path.join(os.homedir(), p.slice(2)) : p);
  // Hosts that rebuild the app folder on every deploy (e.g. Hostinger's ".../hbuilds/...")
  // would wipe a database stored inside it, so keep it in the home directory instead.
  if (/[\\/](hbuilds|releases|versions)[\\/]/.test(process.cwd())) return path.join(os.homedir(), "research-desk-data", "research-desk.db");
  return path.resolve(process.cwd(), "data", "research-desk.db");
}

export function migrate(db: DB): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)`);
  const applied = new Set(
    (db.prepare("SELECT id FROM schema_migrations").all() as { id: number }[]).map((r) => r.id),
  );
  for (const m of migrations) {
    if (applied.has(m.id)) continue;
    db.transaction(() => {
      db.exec(m.sql);
      db.prepare("INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)").run(
        m.id,
        m.name,
        new Date().toISOString(),
      );
    })();
  }
}

/** Open (and initialise) a database at an explicit path. Used by tests and scripts. */
export function openDb(file: string): DB {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  migrate(db);
  seedDefaults(db);
  return db;
}

/** Process-wide connection (survives Next.js dev hot reloads). */
export function getDb(): DB {
  if (!globalForDb.__researchDb) {
    globalForDb.__researchDb = openDb(resolveDbPath());
    // Optional scheduled ingestion, started with the first server-side DB use.
    const minutes = Number(process.env.INGEST_INTERVAL_MINUTES ?? 0);
    if (minutes >= 5 && !process.env.VITEST) void import("../scheduler").then((m) => m.startScheduler(minutes));
  }
  return globalForDb.__researchDb;
}

/** For tests: swap the process-wide connection. */
export function setDbForTesting(db: DB | undefined): void {
  globalForDb.__researchDb = db;
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value === "") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
