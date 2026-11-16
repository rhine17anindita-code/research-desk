import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { newId, nowIso } from "@/lib/ids";
import { fetchFeedXml, parseFeed } from "@/lib/ingest/rss";

/** Add a feed. The URL is fetched once to confirm it parses, so broken feeds are caught up front. */
export const POST = route(async (req: Request) => {
  const b = await body<{ url: string; name?: string; region?: string; category?: string }>(req);
  if (!/^https?:\/\//i.test(b.url ?? "")) throw new Error("Enter a full feed URL starting with http(s)://");
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
  return { ok: true, id, items: count };
});
