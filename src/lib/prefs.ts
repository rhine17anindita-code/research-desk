import type { DB } from "./db";
import { parseJson } from "./db";
import { activeChannelId } from "./channels";
import { nowIso } from "./ids";
import { defaultPrefs, FORMATS, prefsText, TOPICS, type Prefs } from "./prefs-shared";

export function getPrefs(db: DB, channelId = activeChannelId(db)): Prefs {
  const r = db.prepare("SELECT prefs FROM channels WHERE id = ?").get(channelId) as { prefs: string | null } | undefined;
  const saved = parseJson<Partial<Prefs>>(r?.prefs ?? "{}", {});
  const d = defaultPrefs();
  return { ...d, ...saved, topics: { ...d.topics, ...(saved.topics ?? {}) }, formats: { ...d.formats, ...(saved.formats ?? {}) } };
}

export function updatePrefs(db: DB, patch: Partial<Prefs>, channelId = activeChannelId(db)): Prefs {
  const n = { ...getPrefs(db, channelId), ...patch };
  const clamp = (v: unknown) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
  const clean: Prefs = {
    topics: Object.fromEntries(TOPICS.map((t) => [t.id, clamp(n.topics[t.id])])),
    formats: Object.fromEntries(FORMATS.map((f) => [f.id, clamp(n.formats[f.id])])),
    boldness: clamp(n.boldness), depth: clamp(n.depth), audienceQuestions: clamp(n.audienceQuestions), notes: !!n.notes,
  };
  db.prepare("UPDATE channels SET prefs = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(clean), nowIso(), channelId);
  return clean;
}

export const prefsBlock = (db: DB) => prefsText(getPrefs(db));
