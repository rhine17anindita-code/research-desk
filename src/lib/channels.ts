import type { DB } from "./db";
import { newId, nowIso } from "./ids";

/**
 * Channels are separate creator personalities/brands (e.g. "Politics & current affairs",
 * "Books, film & culture"). The news database is shared; each channel has its own
 * sources, profile, learned taste, ideas, inspirations and projects.
 */

export interface Channel {
  id: string;
  name: string;
  description: string | null;
  profile: string;
  tasteSummary: string;
  tasteUpdatedAt: string | null;
  geo: string;
  dailyIdeas: boolean;
  lastDailyAt: string | null;
  position: number;
}

interface Row {
  id: string; name: string; description: string | null; profile: string; taste_summary: string; taste_updated_at: string | null; geo: string;
  daily_ideas: number; last_daily_at: string | null; position: number;
}

const map = (r: Row): Channel => ({
  id: r.id, name: r.name, description: r.description, profile: r.profile, tasteSummary: r.taste_summary, tasteUpdatedAt: r.taste_updated_at, geo: r.geo,
  dailyIdeas: !!r.daily_ideas, lastDailyAt: r.last_daily_at, position: r.position,
});

export function listChannels(db: DB): Channel[] {
  return (db.prepare("SELECT * FROM channels ORDER BY position, created_at").all() as Row[]).map(map);
}

export function getChannel(db: DB, id: string): Channel | null {
  const r = db.prepare("SELECT * FROM channels WHERE id = ?").get(id) as Row | undefined;
  return r ? map(r) : null;
}

export function activeChannelId(db: DB): string {
  const r = db.prepare("SELECT value FROM settings WHERE key = 'channel.active'").get() as { value: string } | undefined;
  const id = r ? (JSON.parse(r.value) as string) : "ch_default";
  if (db.prepare("SELECT 1 FROM channels WHERE id = ?").get(id)) return id;
  const first = db.prepare("SELECT id FROM channels ORDER BY position LIMIT 1").get() as { id: string } | undefined;
  return first?.id ?? "ch_default";
}

export function activeChannel(db: DB): Channel {
  return getChannel(db, activeChannelId(db))!;
}

export function setActiveChannel(db: DB, id: string): void {
  if (!getChannel(db, id)) throw new Error("Channel not found");
  db.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('channel.active', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").run(
    JSON.stringify(id), nowIso(),
  );
}

/** Feed categories a new channel starts with, by template. */
export const CHANNEL_TEMPLATES: Record<string, { label: string; categories: string[] }> = {
  news: { label: "News, politics & current affairs", categories: ["international", "regional", "investigative", "official", "analysis", "research", "topic"] },
  culture: { label: "Books, film, music & culture", categories: ["culture"] },
  business: { label: "Business, tech & science", categories: ["industry", "science", "analysis"] },
  blank: { label: "Start empty (pick sources yourself)", categories: [] },
};

export function createChannel(db: DB, input: { name: string; description?: string; template?: string; geo?: string }): Channel {
  const id = newId("ch");
  const now = nowIso();
  const pos = (db.prepare("SELECT COALESCE(MAX(position), 0) + 1 AS p FROM channels").get() as { p: number }).p;
  db.prepare("INSERT INTO channels (id, name, description, geo, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    id, input.name.trim(), input.description ?? null, (input.geo || "US").toUpperCase().slice(0, 2), pos, now, now,
  );
  const cats = CHANNEL_TEMPLATES[input.template ?? "blank"]?.categories ?? [];
  if (cats.length) {
    db.prepare(`INSERT OR IGNORE INTO channel_feeds (channel_id, feed_id) SELECT ?, id FROM feeds WHERE category IN (${cats.map(() => "?").join(",")})`).run(id, ...cats);
  }
  return getChannel(db, id)!;
}

export function updateChannel(db: DB, id: string, patch: Partial<Pick<Channel, "name" | "description" | "profile" | "tasteSummary" | "tasteUpdatedAt" | "geo" | "dailyIdeas" | "lastDailyAt">>): Channel | null {
  const c = getChannel(db, id);
  if (!c) return null;
  const n = { ...c, ...patch };
  db.prepare(
    "UPDATE channels SET name = ?, description = ?, profile = ?, taste_summary = ?, taste_updated_at = ?, geo = ?, daily_ideas = ?, last_daily_at = ?, updated_at = ? WHERE id = ?",
  ).run(n.name, n.description, n.profile, n.tasteSummary, n.tasteUpdatedAt, n.geo.toUpperCase().slice(0, 2), n.dailyIdeas ? 1 : 0, n.lastDailyAt, nowIso(), id);
  return getChannel(db, id);
}

/** Deleting a channel keeps its ideas, inspirations and projects (they move to the first remaining channel). */
export function deleteChannel(db: DB, id: string): void {
  const count = (db.prepare("SELECT COUNT(*) AS n FROM channels").get() as { n: number }).n;
  if (count <= 1) throw new Error("You need at least one channel");
  db.transaction(() => {
    db.prepare("DELETE FROM channels WHERE id = ?").run(id);
    const to = (db.prepare("SELECT id FROM channels ORDER BY position LIMIT 1").get() as { id: string }).id;
    for (const t of ["ideas", "inspirations", "taste_events", "projects"]) db.prepare(`UPDATE ${t} SET channel_id = ? WHERE channel_id = ?`).run(to, id);
    if (activeChannelId(db) === id) setActiveChannel(db, to);
  })();
}

export function channelFeedIds(db: DB, channelId: string): string[] {
  return (db.prepare("SELECT feed_id FROM channel_feeds WHERE channel_id = ?").all(channelId) as { feed_id: string }[]).map((r) => r.feed_id);
}

export function setFeedChannel(db: DB, channelId: string, feedId: string, on: boolean): void {
  if (on) db.prepare("INSERT OR IGNORE INTO channel_feeds (channel_id, feed_id) VALUES (?, ?)").run(channelId, feedId);
  else db.prepare("DELETE FROM channel_feeds WHERE channel_id = ? AND feed_id = ?").run(channelId, feedId);
}

/** SQL fragment restricting clusters (alias c) to stories reported by this channel's feeds. Bind the channel id. */
export const CHANNEL_CLUSTER_SQL = "c.id IN (SELECT a.cluster_id FROM articles a JOIN channel_feeds cf ON cf.feed_id = a.feed_id WHERE cf.channel_id = ? AND a.cluster_id IS NOT NULL)";
