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
  color: string;
  newsRatio: number;
  boostTerms: string[];
  muteTerms: string[];
  goodExamples: string;
  badExamples: string;
  referenceCreators: string;
  links: ChannelLinks;
  youtubeChannelId: string | null;
  voiceSamples: string;
  /** Facebook Page id for this channel (its linked Instagram comes with it). */
  metaPageId: string | null;
}

export interface ChannelLinks { youtube?: string; instagram?: string; facebook?: string; tiktok?: string }
export const PLATFORMS = ["youtube", "instagram", "facebook", "tiktok"] as const;

/** Strip tracking parameters (?si=, ?_t=, ?xtok=…) from a profile link. */
export function cleanProfileUrl(u: string): string {
  const t = u.trim();
  if (!t) return "";
  try {
    const x = new URL(/^https?:/.test(t) ? t : `https://${t}`);
    return `${x.origin}${x.pathname}`;
  } catch {
    return t;
  }
}

function parseLinks(s: string | null): ChannelLinks {
  try {
    const o = JSON.parse(s || "{}") as Record<string, unknown>;
    return Object.fromEntries(PLATFORMS.filter((p) => typeof o[p] === "string" && o[p]).map((p) => [p, o[p] as string]));
  } catch {
    return {};
  }
}

interface Row {
  id: string; name: string; description: string | null; profile: string; taste_summary: string; taste_updated_at: string | null; geo: string;
  daily_ideas: number; last_daily_at: string | null; position: number;
  color: string; news_ratio: number; boost_terms: string; mute_terms: string; good_examples: string; bad_examples: string; reference_creators: string;
  links: string | null; youtube_channel_id: string | null; voice_samples: string | null; meta_page_id: string | null;
}

const map = (r: Row): Channel => ({
  id: r.id, name: r.name, description: r.description, profile: r.profile, tasteSummary: r.taste_summary, tasteUpdatedAt: r.taste_updated_at, geo: r.geo,
  dailyIdeas: !!r.daily_ideas, lastDailyAt: r.last_daily_at, position: r.position,
  color: r.color, newsRatio: r.news_ratio, boostTerms: splitTerms(r.boost_terms), muteTerms: splitTerms(r.mute_terms),
  goodExamples: r.good_examples, badExamples: r.bad_examples, referenceCreators: r.reference_creators,
  links: parseLinks(r.links), youtubeChannelId: r.youtube_channel_id, voiceSamples: r.voice_samples ?? "", metaPageId: r.meta_page_id ?? null,
});

export function splitTerms(s: string): string[] {
  return s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
}

/** Channel colour palette (names map to CSS accent tokens). */
export const CHANNEL_COLORS = ["coral", "teal", "violet", "amber", "blue", "rose", "green"] as const;

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

export type ChannelPatch = Partial<Pick<Channel, "name" | "description" | "profile" | "tasteSummary" | "tasteUpdatedAt" | "geo" | "dailyIdeas" | "lastDailyAt" | "color" | "newsRatio" | "goodExamples" | "badExamples" | "referenceCreators" | "links" | "youtubeChannelId" | "voiceSamples" | "metaPageId">> & {
  boostTerms?: string[] | string;
  muteTerms?: string[] | string;
};

export function updateChannel(db: DB, id: string, patch: ChannelPatch): Channel | null {
  const c = getChannel(db, id);
  if (!c) return null;
  const n = { ...c, ...patch };
  if (patch.links) {
    n.links = Object.fromEntries(PLATFORMS.map((p) => [p, cleanProfileUrl(patch.links?.[p] ?? "")]).filter(([, v]) => v));
    // A new YouTube link means the channel id has to be looked up again.
    if (n.links.youtube !== c.links.youtube && patch.youtubeChannelId === undefined) n.youtubeChannelId = null;
  }
  const terms = (v: string[] | string) => (Array.isArray(v) ? v : splitTerms(v)).join(", ");
  db.prepare(
    `UPDATE channels SET name = ?, description = ?, profile = ?, taste_summary = ?, taste_updated_at = ?, geo = ?, daily_ideas = ?, last_daily_at = ?,
       color = ?, news_ratio = ?, boost_terms = ?, mute_terms = ?, good_examples = ?, bad_examples = ?, reference_creators = ?, links = ?, youtube_channel_id = ?, voice_samples = ?, meta_page_id = ?, updated_at = ? WHERE id = ?`,
  ).run(
    n.name, n.description, n.profile, n.tasteSummary, n.tasteUpdatedAt, n.geo.toUpperCase().slice(0, 2), n.dailyIdeas ? 1 : 0, n.lastDailyAt,
    n.color, Math.max(0, Math.min(100, Math.round(n.newsRatio))), terms(n.boostTerms), terms(n.muteTerms), n.goodExamples, n.badExamples, n.referenceCreators, JSON.stringify(n.links), n.youtubeChannelId, n.voiceSamples, n.metaPageId || null, nowIso(), id,
  );
  return getChannel(db, id);
}

/** Case-insensitive whole-word matcher for a channel's boost/mute terms. */
export function termMatcher(terms: string[]): (text: string) => string[] {
  const res = terms.map((t) => ({ t, re: new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i") }));
  return (text: string) => res.filter((x) => x.re.test(text)).map((x) => x.t);
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
export const CHANNEL_CLUSTER_SQL = "c.id IN (SELECT a.cluster_id FROM articles a JOIN channel_feeds cf ON cf.feed_id = a.feed_id JOIN feeds rf ON rf.id = a.feed_id WHERE cf.channel_id = ? AND a.cluster_id IS NOT NULL AND COALESCE(rf.category, '') NOT IN ('reference', 'talk'))";
