import type { DB } from "../db";
import { activeChannel, listChannels } from "../channels";
import { json, videoStats, youtubeConfigured } from "../media";
import { ownYoutube } from "../ideation/own";
import { nowIso } from "../ids";
import { getSetting, setSetting } from "../repo/settings";
import { listPosts, upsertDaily, upsertPost } from "./store";

/**
 * Pulls every upload of the creator's YouTube channel with its numbers, today's
 * subscriber/view totals, and public comments on recent videos. Uses the API key only
 * (about 1 quota unit per 50 videos + 1 per video's comments). Watch time, CTR and
 * retention need YouTube Analytics (a Google sign-in), which this doesn't use.
 */

const key = () => encodeURIComponent(process.env.YOUTUBE_API_KEY!);

export async function syncYoutube(db: DB, opts: { maxVideos?: number; commentVideos?: number; channelId?: string } = {}): Promise<{ videos: number; comments: number } | null> {
  if (!youtubeConfigured()) return null;
  const channelId = opts.channelId ?? activeChannel(db).id;
  const own = await ownYoutube(db, channelId);
  if (!own) return null;
  const ch = await json<{ items?: { contentDetails: { relatedPlaylists: { uploads: string } } }[] }>(
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${own.id}&key=${key()}`,
  );
  const uploads = ch.items?.[0]?.contentDetails.relatedPlaylists.uploads;
  if (!uploads) return null;

  // Every upload (paged, 50 at a time).
  const items: { id: string; title: string; publishedAt: string; thumb: string | null }[] = [];
  let page = "";
  do {
    const pl = await json<{ nextPageToken?: string; items?: { snippet: { title: string; publishedAt: string; resourceId: { videoId: string }; thumbnails?: Record<string, { url: string }> } }[] }>(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${uploads}&key=${key()}${page ? `&pageToken=${page}` : ""}`,
    );
    for (const i of pl.items ?? []) {
      if (i.snippet.title === "Private video" || i.snippet.title === "Deleted video") continue;
      const th = i.snippet.thumbnails ?? {};
      items.push({ id: i.snippet.resourceId.videoId, title: i.snippet.title, publishedAt: i.snippet.publishedAt, thumb: (th.medium ?? th.high ?? th.default)?.url ?? null });
    }
    page = pl.nextPageToken ?? "";
  } while (page && items.length < (opts.maxVideos ?? 500));

  for (let i = 0; i < items.length; i += 50) {
    const batch = items.slice(i, i + 50);
    const stats = await videoStats(batch.map((b) => b.id));
    for (const b of batch) {
      const st = stats.get(b.id);
      const short = st?.seconds != null && st.seconds <= 180;
      upsertPost(db, {
        platform: "youtube", postId: b.id, url: short ? `https://www.youtube.com/shorts/${b.id}` : `https://www.youtube.com/watch?v=${b.id}`, title: b.title,
        kind: st?.seconds == null ? null : short ? "short" : "video", publishedAt: b.publishedAt, durationS: st?.seconds ?? null, views: st?.views ?? null, reach: null,
        likes: st?.likes ?? null, comments: st?.comments ?? null, shares: null, saves: null, follows: null, thumbnail: b.thumb, source: "api",
      }, channelId);
    }
  }
  upsertDaily(db, { platform: "youtube", date: nowIso().slice(0, 10), followers: own.subscribers, views: own.totalViews }, channelId);

  // Public comments on the most recent videos that have any.
  let comments = 0;
  const recent = listPosts(db, { platform: "youtube", limit: 60, channelId }).filter((p) => (p.comments ?? 0) > 0).slice(0, opts.commentVideos ?? 20);
  const ins = db.prepare(
    `INSERT INTO own_comments (id, channel_id, platform, post_id, author, text, likes, replies, published_at, fetched_at) VALUES (?, ?, 'youtube', ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET likes = excluded.likes, replies = excluded.replies, text = excluded.text, fetched_at = excluded.fetched_at`,
  );
  const chId = channelId;
  for (const p of recent) {
    try {
      const j = await json<{ items?: { id: string; snippet: { totalReplyCount?: number; topLevelComment: { snippet: { authorDisplayName?: string; textOriginal?: string; likeCount?: number; publishedAt?: string } } } }[] }>(
        `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&maxResults=50&order=relevance&textFormat=plainText&videoId=${p.postId}&key=${key()}`,
      );
      for (const c of j.items ?? []) {
        const s = c.snippet.topLevelComment.snippet;
        if (!s.textOriginal?.trim()) continue;
        ins.run(c.id, chId, p.postId, s.authorDisplayName ?? null, s.textOriginal.slice(0, 2000), s.likeCount ?? 0, c.snippet.totalReplyCount ?? 0, s.publishedAt ?? null, nowIso());
        comments++;
      }
    } catch {
      /* comments off for this video, or quota */
    }
  }
  setSetting(db, "perf.youtube_synced_at", nowIso());
  return { videos: items.length, comments };
}

/** Background sync for every channel with a YouTube link, if the last one is older than `hours`. */
export async function syncYoutubeIfStale(db: DB, hours = 6) {
  const last = getSetting(db, "perf.youtube_synced_at");
  if (last && Date.now() - Date.parse(last) < hours * 3_600_000) return null;
  let total = 0;
  for (const ch of listChannels(db).filter((c) => c.links.youtube)) {
    try {
      total += (await syncYoutube(db, { channelId: ch.id }))?.videos ?? 0;
    } catch (e) {
      console.error("[perf] youtube sync failed", ch.name, (e as Error).message);
    }
  }
  setSetting(db, "perf.youtube_synced_at", nowIso());
  return total;
}
