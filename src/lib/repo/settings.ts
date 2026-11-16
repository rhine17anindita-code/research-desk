import type { DB } from "../db";
import { parseJson } from "../db";
import { nowIso } from "../ids";
import { DEFAULT_SETTINGS, type AppSettings } from "../settings-defaults";

export function getSetting<K extends keyof AppSettings>(db: DB, key: K): AppSettings[K] {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row ? parseJson<AppSettings[K]>(row.value, DEFAULT_SETTINGS[key]) : DEFAULT_SETTINGS[key];
}

export function getAllSettings(db: DB): AppSettings {
  const out = { ...DEFAULT_SETTINGS } as AppSettings;
  for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[]) {
    (out as unknown as Record<string, unknown>)[k] = getSetting(db, k);
  }
  return out;
}

export function setSetting<K extends keyof AppSettings>(db: DB, key: K, value: AppSettings[K]): void {
  db.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
  ).run(key, JSON.stringify(value), nowIso());
}
