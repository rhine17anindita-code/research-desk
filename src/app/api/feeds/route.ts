import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { newId, nowIso } from "@/lib/ids";
import { fetchFeedXml, parseFeed } from "@/lib/ingest/rss";
import { googleNewsTopicUrl } from "@/lib/ingest/default-feeds";
import { youtubeChannelFeed } from "@/lib/media";
import { activeChannelId } from "@/lib/channels";

/** Add a feed. The URL is fetched once to confirm it parses, so broken feeds are caught up front. */
export const POST = route(async (req: Request) => {
  const b = await body<{ url?: string; topic?: string; youtube?: string; name?: string; region?: string; category?: string }>(req);
  if (b.youtube?.trim()) {
    // Follow a YouTube channel: its public RSS feed of recent videos.
    const yt = await youtubeChannelFeed(b.youtube.trim());
    if (!yt) throw new Error("Couldn't find that YouTube channel. Paste the channel URL or its @handle.");
    b.url = yt.url;
    b.name = b.name || `YouTube: ${yt.name}`;
    b.category = "video";
  }
  if (b.topic?.trim()) {
    // Topic watch: a Google News search feed for these words.
    const topic = b.topic.trim().slice(0, 120);
    b.url = googleNewsTopicUrl(topic);
    b.name = `Topic: ${topic}`;
    b.category = "topic";
  }
  if (!/^https?:\/\//i.test(b.url ?? "")) throw new Error("Enter a full feed URL starting with http(s)://");
  b.url = b.url!;
  const db = getDb();
  if (db.prepare("SELECT 1 FROM feeds WHERE url = ?").get(b.url)) throw new Error("That feed is already in your list");
  let title: string | null = null;
  let site: string | null = null;
  let count = 0;
  try {
    const parsed = await parseFeed(await fetchFeedXml(b.url));
    title = parsed.title;
    site = parsed.siteUrl;
    count = parsed.items.length;
  } catch (err) {
    throw new Error(`Could not read that feed: ${(err as Error).message}`);
  }
  const id = newId("feed");
  const now = nowIso();
  db.prepare(
    "INSERT INTO feeds (id, name, url, site_url, region, category, enabled, priority, last_status, last_item_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, 1, 'ok', ?, ?, ?)",
  ).run(id, b.name?.trim() || title || new URL(b.url).hostname, b.url, site, b.region || "Global", b.category || "international", count, now, now);
  // New sources join the channel you are working in.
  db.prepare("INSERT OR IGNORE INTO channel_feeds (channel_id, feed_id) VALUES (?, ?)").run(activeChannelId(db), id);
  return { ok: true, id, items: count };
});
