import type { DB } from "../db";
import { activeChannelId } from "../channels";
import { nowIso } from "../ids";

/** The creator's own posts and account numbers across platforms. */

export const PERF_PLATFORMS = ["youtube", "instagram", "facebook", "tiktok"] as const;
export type PerfPlatform = (typeof PERF_PLATFORMS)[number];

export interface OwnPost {
  id: string; platform: PerfPlatform; postId: string; url: string | null; title: string; kind: string | null; publishedAt: string | null;
  durationS: number | null; views: number | null; reach: number | null; likes: number | null; comments: number | null; shares: number | null;
  saves: number | null; follows: number | null; thumbnail: string | null; source: "api" | "csv"; updatedAt: string;
}
export type PostInput = Omit<OwnPost, "id" | "updatedAt">;

interface Row {
  id: string; platform: string; post_id: string; url: string | null; title: string; kind: string | null; published_at: string | null; duration_s: number | null;
  views: number | null; reach: number | null; likes: number | null; comments: number | null; shares: number | null; saves: number | null; follows: number | null;
  thumbnail: string | null; source: string; updated_at: string;
}
const map = (r: Row): OwnPost => ({
  id: r.id, platform: r.platform as PerfPlatform, postId: r.post_id, url: r.url, title: r.title, kind: r.kind, publishedAt: r.published_at, durationS: r.duration_s,
  views: r.views, reach: r.reach, likes: r.likes, comments: r.comments, shares: r.shares, saves: r.saves, follows: r.follows, thumbnail: r.thumbnail,
  source: r.source as OwnPost["source"], updatedAt: r.updated_at,
});

/** Insert or update a post; numbers only ever replace with a real value (a missing column keeps the old one). */
export function upsertPost(db: DB, p: PostInput, channelId = activeChannelId(db)): void {
  const id = `${p.platform}:${p.postId}`;
  db.prepare(
    `INSERT INTO own_posts (id, channel_id, platform, post_id, url, title, kind, published_at, duration_s, views, reach, likes, comments, shares, saves, follows, thumbnail, source, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       url = COALESCE(excluded.url, url), title = CASE WHEN excluded.title != '' THEN excluded.title ELSE title END, kind = COALESCE(excluded.kind, kind),
       published_at = COALESCE(excluded.published_at, published_at), duration_s = COALESCE(excluded.duration_s, duration_s),
       views = COALESCE(excluded.views, views), reach = COALESCE(excluded.reach, reach), likes = COALESCE(excluded.likes, likes), comments = COALESCE(excluded.comments, comments),
       shares = COALESCE(excluded.shares, shares), saves = COALESCE(excluded.saves, saves), follows = COALESCE(excluded.follows, follows),
       thumbnail = COALESCE(excluded.thumbnail, thumbnail), source = excluded.source, updated_at = excluded.updated_at`,
  ).run(
    id, channelId, p.platform, p.postId, p.url, p.title ?? "", p.kind, p.publishedAt, p.durationS, p.views, p.reach, p.likes, p.comments, p.shares, p.saves, p.follows,
    p.thumbnail, p.source, nowIso(),
  );
}

export function listPosts(db: DB, opts: { platform?: string; days?: number; limit?: number; channelId?: string } = {}): OwnPost[] {
  const where = ["(channel_id = ? OR channel_id IS NULL)"];
  const args: unknown[] = [opts.channelId ?? activeChannelId(db)];
  if (opts.platform) { where.push("platform = ?"); args.push(opts.platform); }
  if (opts.days) { where.push("published_at >= strftime('%Y-%m-%dT%H:%M:%SZ', 'now', ?)"); args.push(`-${opts.days} days`); }
  return (db.prepare(`SELECT * FROM own_posts WHERE ${where.join(" AND ")} ORDER BY published_at DESC LIMIT ?`).all(...args, opts.limit ?? 2000) as Row[]).map(map);
}

export interface DailyInput { platform: PerfPlatform; date: string; followers?: number | null; views?: number | null; likes?: number | null; comments?: number | null; shares?: number | null; profileViews?: number | null }
export function upsertDaily(db: DB, d: DailyInput, channelId = activeChannelId(db)): void {
  db.prepare(
    `INSERT INTO own_daily (channel_id, platform, date, followers, views, likes, comments, shares, profile_views) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(channel_id, platform, date) DO UPDATE SET followers = COALESCE(excluded.followers, followers), views = COALESCE(excluded.views, views),
       likes = COALESCE(excluded.likes, likes), comments = COALESCE(excluded.comments, comments), shares = COALESCE(excluded.shares, shares),
       profile_views = COALESCE(excluded.profile_views, profile_views)`,
  ).run(channelId, d.platform, d.date, d.followers ?? null, d.views ?? null, d.likes ?? null, d.comments ?? null, d.shares ?? null, d.profileViews ?? null);
}
export function listDaily(db: DB, platform: string, days = 120) {
  return db
    .prepare("SELECT date, followers, views, likes, comments, shares, profile_views AS profileViews FROM own_daily WHERE (channel_id = ? OR channel_id IS NULL) AND platform = ? AND date >= date('now', ?) ORDER BY date")
    .all(activeChannelId(db), platform, `-${days} days`) as { date: string; followers: number | null; views: number | null; likes: number | null; comments: number | null; shares: number | null; profileViews: number | null }[];
}

export interface OwnComment { id: string; postId: string; author: string | null; text: string; likes: number; replies: number; publishedAt: string | null }
export function listComments(db: DB, opts: { limit?: number; postId?: string } = {}): OwnComment[] {
  return db
    .prepare(
      `SELECT id, post_id AS postId, author, text, likes, replies, published_at AS publishedAt FROM own_comments WHERE (channel_id = ? OR channel_id IS NULL) ${opts.postId ? "AND post_id = ?" : ""}
       ORDER BY published_at DESC LIMIT ?`,
    )
    .all(...[activeChannelId(db), ...(opts.postId ? [opts.postId] : []), opts.limit ?? 500]) as OwnComment[];
}

export function saveReport(db: DB, kind: "comments" | "strategy", body: unknown, id: string): void {
  db.prepare("INSERT INTO own_reports (id, channel_id, kind, body, created_at) VALUES (?, ?, ?, ?, ?)").run(id, activeChannelId(db), kind, JSON.stringify(body), nowIso());
}
export function latestReport<T>(db: DB, kind: "comments" | "strategy"): { id: string; body: T; createdAt: string } | null {
  const r = db.prepare("SELECT id, body, created_at FROM own_reports WHERE (channel_id = ? OR channel_id IS NULL) AND kind = ? ORDER BY created_at DESC LIMIT 1").get(activeChannelId(db), kind) as
    | { id: string; body: string; created_at: string }
    | undefined;
  return r ? { id: r.id, body: JSON.parse(r.body) as T, createdAt: r.created_at } : null;
}
