import type { DB } from "./db";
import { nowIso } from "./ids";

/** Keys pasted in the app (server-side only). An environment variable with the same name wins. */
export type SecretName = "SUPADATA_API_KEY";

export function getSecret(db: DB, name: SecretName): string | null {
  const env = process.env[name]?.trim();
  if (env) return env;
  try {
    return (db.prepare("SELECT value FROM secrets WHERE key = ?").get(name) as { value: string } | undefined)?.value ?? null;
  } catch {
    return null;
  }
}

export function setSecret(db: DB, name: SecretName, value: string | null) {
  if (!value) db.prepare("DELETE FROM secrets WHERE key = ?").run(name);
  else db.prepare("INSERT INTO secrets (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").run(name, value, nowIso());
}

export function secretSource(name: SecretName, db: DB): "env" | "app" | null {
  if (process.env[name]?.trim()) return "env";
  return getSecret(db, name) ? "app" : null;
}
