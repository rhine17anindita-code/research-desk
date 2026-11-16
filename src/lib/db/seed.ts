import type Database from "better-sqlite3";
import { DEFAULT_FEEDS, FEED_CATALOG_VERSION } from "../ingest/default-feeds";
import { BUILTIN_SIGNALS } from "../signals";
import { newId, nowIso } from "../ids";
import { DEFAULT_SETTINGS } from "../settings-defaults";

/** Idempotent: inserts defaults only where nothing exists yet. */
export function seedDefaults(db: Database.Database): void {
  const now = nowIso();
  const seeded = db.prepare("SELECT value FROM settings WHERE key = 'seeded'").get();
  if (seeded) {
    addNewCatalogFeeds(db);
    return;
  }

  db.transaction(() => {
    const insFeed = db.prepare(
      `INSERT OR IGNORE INTO feeds (id, name, url, site_url, region, language, category, enabled, priority, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    );
    for (const f of DEFAULT_FEEDS) {
      insFeed.run(newId("feed"), f.name, f.url, f.siteUrl ?? null, f.region, f.language ?? "en", f.category, f.enabled === false ? 0 : 1, now, now);
    }
    assignFeedChannels(db);

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
    insSetting.run("feeds.catalog_version", JSON.stringify(FEED_CATALOG_VERSION), now);
  })();
}

/** Existing installations: add default feeds introduced since their catalog version (once). */
function addNewCatalogFeeds(db: Database.Database): void {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'feeds.catalog_version'").get() as { value: string } | undefined;
  const version = row ? Number(JSON.parse(row.value)) : 1;
  if (version >= FEED_CATALOG_VERSION) return;
  const now = nowIso();
  db.transaction(() => {
    const ins = db.prepare(
      `INSERT OR IGNORE INTO feeds (id, name, url, site_url, region, language, category, enabled, priority, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    );
    const existing = new Set((db.prepare("SELECT url FROM feeds").all() as { url: string }[]).map((r) => r.url));
    for (const f of DEFAULT_FEEDS) ins.run(newId("feed"), f.name, f.url, f.siteUrl ?? null, f.region, f.language ?? "en", f.category, f.enabled === false ? 0 : 1, now, now);
    assignFeedChannels(db, DEFAULT_FEEDS.filter((f) => !existing.has(f.url)).map((f) => f.url));
    db.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('feeds.catalog_version', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
      .run(JSON.stringify(FEED_CATALOG_VERSION), now);
  })();
}

/** Put default feeds into their channels (only feeds listed in `onlyUrls`, when given). */
function assignFeedChannels(db: Database.Database, onlyUrls?: string[]): void {
  const only = onlyUrls ? new Set(onlyUrls) : null;
  const byUrl = db.prepare("SELECT id FROM feeds WHERE url = ?");
  const ins = db.prepare("INSERT OR IGNORE INTO channel_feeds (channel_id, feed_id) SELECT ?, ? WHERE EXISTS (SELECT 1 FROM channels WHERE id = ?)");
  for (const f of DEFAULT_FEEDS) {
    if (only && !only.has(f.url)) continue;
    const row = byUrl.get(f.url) as { id: string } | undefined;
    if (!row) continue;
    for (const ch of f.channels ?? ["ch_default"]) ins.run(ch, row.id, ch);
  }
}
