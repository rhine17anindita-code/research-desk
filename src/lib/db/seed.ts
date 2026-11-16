import type Database from "better-sqlite3";
import { DEFAULT_FEEDS } from "../ingest/default-feeds";
import { BUILTIN_SIGNALS } from "../signals";
import { newId, nowIso } from "../ids";
import { DEFAULT_SETTINGS } from "../settings-defaults";

/** Idempotent: inserts defaults only where nothing exists yet. */
export function seedDefaults(db: Database.Database): void {
  const now = nowIso();
  const seeded = db.prepare("SELECT value FROM settings WHERE key = 'seeded'").get();
  if (seeded) return;

  db.transaction(() => {
    const insFeed = db.prepare(
      `INSERT OR IGNORE INTO feeds (id, name, url, site_url, region, language, category, enabled, priority, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    );
    for (const f of DEFAULT_FEEDS) {
      insFeed.run(newId("feed"), f.name, f.url, f.siteUrl ?? null, f.region, f.language ?? "en", f.category, f.enabled === false ? 0 : 1, now, now);
    }

    const insSignal = db.prepare(
      `INSERT OR IGNORE INTO signals (id, label, description, cues, weight, learned, enabled, builtin, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, 0, 1, 1, ?, ?)`,
    );
    for (const s of BUILTIN_SIGNALS) {
      insSignal.run(s.id, s.label, s.description, JSON.stringify(s.cues), now, now);
    }

    const insSetting = db.prepare("INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)");
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insSetting.run(k, JSON.stringify(v), now);
    insSetting.run("seeded", JSON.stringify(true), now);
  })();
}
