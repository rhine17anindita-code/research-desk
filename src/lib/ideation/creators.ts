import type { DB } from "../db";
import { activeChannelId } from "../channels";
import { videoStats, youtubeId } from "../media";

/**
 * What reference creators published recently. With a YouTube key, each video gets
 * views per day and a "breakout" multiple versus that channel's typical video.
 */
export interface CreatorVideo {
  title: string;
  url: string;
  channel: string;
  publishedAt: string | null;
  thumbnail: string | null;
  views: number | null;
  viewsPerDay: number | null;
  breakout: number | null;
}

export async function referenceVideos(db: DB, limit = 10): Promise<CreatorVideo[]> {
  const rows = db
    .prepare(
      `SELECT a.title, a.url, a.publisher, a.published_at, a.image_url FROM articles a JOIN feeds f ON f.id = a.feed_id
       WHERE f.category = 'reference' AND (f.id IN (SELECT feed_id FROM channel_feeds WHERE channel_id = ?) OR NOT EXISTS (SELECT 1 FROM channel_feeds WHERE feed_id = f.id))
       AND COALESCE(a.published_at, a.fetched_at) >= datetime('now', '-45 days') ORDER BY COALESCE(a.published_at, a.fetched_at) DESC LIMIT 120`,
    )
    .all(activeChannelId(db)) as { title: string; url: string; publisher: string; published_at: string | null; image_url: string | null }[];
  const ids = rows.map((r) => youtubeId(r.url)).filter((x): x is string => !!x);
  let stats = new Map<string, { views: number }>();
  try {
    stats = await videoStats(ids.slice(0, 50));
    if (ids.length > 50) for (const [k, v] of await videoStats(ids.slice(50, 100))) stats.set(k, v);
  } catch {
    /* no key or quota: show without numbers */
  }
  const vids: CreatorVideo[] = rows.map((r) => {
    const id = youtubeId(r.url);
    const v = id ? stats.get(id) : undefined;
    const days = r.published_at ? Math.max(1, (Date.now() - new Date(r.published_at).getTime()) / 86_400_000) : null;
    return { title: r.title, url: r.url, channel: r.publisher, publishedAt: r.published_at, thumbnail: r.image_url, views: v?.views ?? null, viewsPerDay: v && days ? v.views / days : null, breakout: null };
  });
  // Breakout = this video's views/day versus the median of the same channel's recent videos.
  const byChannel = new Map<string, number[]>();
  for (const v of vids) if (v.viewsPerDay != null) (byChannel.get(v.channel) ?? byChannel.set(v.channel, []).get(v.channel)!).push(v.viewsPerDay);
  for (const v of vids) {
    const arr = byChannel.get(v.channel);
    if (v.viewsPerDay == null || !arr || arr.length < 3) continue;
    const sorted = [...arr].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    v.breakout = median > 0 ? v.viewsPerDay / median : null;
  }
  const hasStats = vids.some((v) => v.views != null);
  const ranked = hasStats ? [...vids].sort((a, b) => (b.breakout ?? 0) - (a.breakout ?? 0) || (b.viewsPerDay ?? 0) - (a.viewsPerDay ?? 0)) : vids;
  return ranked.slice(0, limit);
}
