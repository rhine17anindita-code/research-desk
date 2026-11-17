import { USER_AGENT } from "./ingest/rss";
import { safeFetch } from "./net";
import { stripHtml, truncate } from "./text";

/**
 * Visual and archival material for a story or idea, from free public sources:
 *  - Wikimedia Commons: freely licensed photos, maps and documents (licence + credit included)
 *  - Internet Archive: historical footage, audio, texts and images
 *  - YouTube: video search via the official Data API when YOUTUBE_API_KEY is set
 *    (free daily quota); otherwise a ready-made YouTube search link.
 * Results are cached in memory for an hour.
 */

export interface MediaItem {
  kind: "image" | "video" | "archive";
  title: string;
  url: string;
  thumbnail: string | null;
  meta: string | null; // licence/credit, channel, year…
  source: "commons" | "archive" | "youtube";
}

const cache = new Map<string, { at: number; items: MediaItem[] }>();
const TTL = 3600_000;

export async function json<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function cached(key: string, fn: () => Promise<MediaItem[]>): Promise<MediaItem[]> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.items;
  const items = await fn();
  cache.set(key, { at: Date.now(), items });
  return items;
}

export function searchCommons(q: string, limit = 12): Promise<MediaItem[]> {
  return cached(`c:${q}`, async () => {
    const j = await json<{ query?: { pages?: Record<string, { title: string; index?: number; imageinfo?: { thumburl?: string; descriptionurl?: string; extmetadata?: Record<string, { value: string }> }[] }> } }>(
      `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(q + " filetype:bitmap")}&gsrlimit=${limit}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=480&format=json&origin=*`,
    );
    return Object.values(j.query?.pages ?? {})
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map((p) => {
        const ii = p.imageinfo?.[0];
        const md = ii?.extmetadata ?? {};
        const licence = md.LicenseShortName?.value;
        const artist = md.Artist?.value ? truncate(stripHtml(md.Artist.value), 60) : null;
        return {
          kind: "image" as const,
          title: (md.ObjectName?.value ? stripHtml(md.ObjectName.value) : p.title.replace(/^File:/, "").replace(/\.[a-z]+$/i, "")).slice(0, 120),
          url: ii?.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
          thumbnail: ii?.thumburl ?? null,
          meta: [licence, artist].filter(Boolean).join(" · ") || null,
          source: "commons" as const,
        };
      })
      .filter((x) => x.thumbnail);
  });
}

export function searchArchive(q: string, limit = 12): Promise<MediaItem[]> {
  return cached(`a:${q}`, async () => {
    const params = new URLSearchParams({ q: `(${q}) AND mediatype:(movies OR texts OR audio OR image)`, rows: String(limit), output: "json", sort: "downloads desc" });
    for (const f of ["identifier", "title", "mediatype", "year", "creator"]) params.append("fl[]", f);
    const j = await json<{ response?: { docs?: { identifier: string; title?: string; mediatype?: string; year?: string; creator?: string | string[] }[] } }>(`https://archive.org/advancedsearch.php?${params}`);
    return (j.response?.docs ?? []).map((d) => ({
      kind: "archive" as const,
      title: truncate(stripHtml(d.title ?? d.identifier), 120),
      url: `https://archive.org/details/${d.identifier}`,
      thumbnail: `https://archive.org/services/img/${d.identifier}`,
      meta: [d.mediatype === "movies" ? "Video" : d.mediatype === "texts" ? "Text" : d.mediatype === "audio" ? "Audio" : "Image", d.year, Array.isArray(d.creator) ? d.creator[0] : d.creator].filter(Boolean).join(" · "),
      source: "archive" as const,
    }));
  });
}

export function youtubeConfigured(): boolean {
  return !!process.env.YOUTUBE_API_KEY?.trim();
}

export function youtubeSearchLink(q: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

export function searchYouTube(q: string, limit = 10): Promise<MediaItem[]> {
  if (!youtubeConfigured()) return Promise.resolve([]);
  return cached(`y:${q}`, async () => {
    const j = await json<{ items?: { id: { videoId?: string }; snippet: { title: string; channelTitle: string; publishedAt: string; thumbnails?: { medium?: { url: string } } } }[] }>(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${limit}&order=relevance&q=${encodeURIComponent(q)}&key=${encodeURIComponent(process.env.YOUTUBE_API_KEY!)}`,
    );
    return (j.items ?? [])
      .filter((i) => i.id.videoId)
      .map((i) => ({
        kind: "video" as const,
        title: stripHtml(i.snippet.title),
        url: `https://www.youtube.com/watch?v=${i.id.videoId}`,
        thumbnail: i.snippet.thumbnails?.medium?.url ?? null,
        meta: `${i.snippet.channelTitle} · ${i.snippet.publishedAt.slice(0, 10)}`,
        source: "youtube" as const,
      }));
  });
}

/** Resolve a YouTube channel page/handle to its RSS feed URL (for following a channel as a source). */
export async function youtubeChannelFeed(input: string): Promise<{ url: string; name: string } | null> {
  const direct = input.match(/channel\/(UC[\w-]{20,})/);
  let channelId = direct?.[1] ?? null;
  let name = "";
  if (!channelId) {
    const page = input.startsWith("http") ? input : `https://www.youtube.com/${input.startsWith("@") ? input : "@" + input}`;
    const res = await safeFetch(page, { headers: { "User-Agent": "Mozilla/5.0 (compatible; ResearchDesk/0.1)", "Accept-Language": "en" }, signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    const html = await res.text();
    // Prefer the page's canonical/og URL (the channel itself) over IDs of other channels mentioned on the page.
    channelId =
      html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{20,})"/)?.[1] ??
      html.match(/<meta property="og:url" content="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{20,})"/)?.[1] ??
      html.match(/"externalId":"(UC[\w-]{20,})"/)?.[1] ??
      html.match(/"channelId":"(UC[\w-]{20,})"/)?.[1] ??
      null;
    name = stripHtml(html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] ?? "");
  }
  return channelId ? { url: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, name: name || "YouTube channel" } : null;
}

/** View/like/comment counts for up to 50 YouTube video ids (1 quota unit). Empty without a key. */
export async function videoStats(ids: string[]): Promise<Map<string, { views: number; likes: number; comments: number; seconds: number | null }>> {
  const out = new Map<string, { views: number; likes: number; comments: number; seconds: number | null }>();
  if (!youtubeConfigured() || !ids.length) return out;
  const key = `s:${ids.slice(0, 50).join(",")}`;
  const hit = statsCache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  const j = await json<{ items?: { id: string; statistics?: { viewCount?: string; likeCount?: string; commentCount?: string }; contentDetails?: { duration?: string } }[] }>(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${ids.slice(0, 50).join(",")}&key=${encodeURIComponent(process.env.YOUTUBE_API_KEY!)}`,
  );
  for (const v of j.items ?? []) out.set(v.id, { views: Number(v.statistics?.viewCount ?? 0), likes: Number(v.statistics?.likeCount ?? 0), comments: Number(v.statistics?.commentCount ?? 0), seconds: isoSeconds(v.contentDetails?.duration) });
  statsCache.set(key, { at: Date.now(), data: out });
  return out;
}
const statsCache = new Map<string, { at: number; data: Map<string, { views: number; likes: number; comments: number; seconds: number | null }> }>();

/** "PT1H2M3S" → 3723. */
export function isoSeconds(d: string | undefined): number | null {
  const m = d?.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  return m ? (+(m[1] ?? 0)) * 86400 + (+(m[2] ?? 0)) * 3600 + (+(m[3] ?? 0)) * 60 + (+(m[4] ?? 0)) : null;
}

export function youtubeId(url: string): string | null {
  return url.match(/[?&]v=([\w-]{11})/)?.[1] ?? url.match(/youtu\.be\/([\w-]{11})/)?.[1] ?? url.match(/shorts\/([\w-]{11})/)?.[1] ?? null;
}

export interface OwnVideo { id: string; title: string; url: string; thumbnail: string | null; publishedAt: string; views: number; likes: number; comments: number; seconds: number | null }
export interface OwnChannel { id: string; title: string; url: string; subscribers: number | null; totalViews: number; videoCount: number; recent: OwnVideo[] }
const ownCache = new Map<string, { at: number; data: OwnChannel | null }>();

/** Resolve a YouTube link (…/@handle, …/channel/UC…) to a channel id. */
export async function resolveYoutubeChannel(link: string): Promise<string | null> {
  if (!youtubeConfigured()) return null;
  const direct = link.match(/\/channel\/(UC[\w-]{22})/)?.[1];
  if (direct) return direct;
  const handle = link.match(/\/(@[\w.-]+)/)?.[1];
  if (!handle) return null;
  const j = await json<{ items?: { id: string }[] }>(
    `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${encodeURIComponent(process.env.YOUTUBE_API_KEY!)}`,
  );
  return j.items?.[0]?.id ?? null;
}

/** The creator's own channel: totals plus the latest uploads with their numbers (3 quota units, cached 1h). */
export async function ownChannelStats(channelId: string, limit = 12): Promise<OwnChannel | null> {
  if (!youtubeConfigured()) return null;
  const hit = ownCache.get(channelId);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  const key = encodeURIComponent(process.env.YOUTUBE_API_KEY!);
  const ch = await json<{ items?: { id: string; snippet: { title: string; customUrl?: string }; statistics: { viewCount?: string; subscriberCount?: string; hiddenSubscriberCount?: boolean; videoCount?: string }; contentDetails: { relatedPlaylists: { uploads: string } } }[] }>(
    `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${channelId}&key=${key}`,
  );
  const c = ch.items?.[0];
  if (!c) {
    ownCache.set(channelId, { at: Date.now(), data: null });
    return null;
  }
  const pl = await json<{ items?: { snippet: { title: string; publishedAt: string; resourceId: { videoId: string }; thumbnails?: Record<string, { url: string }> } }[] }>(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=${Math.min(50, limit)}&playlistId=${c.contentDetails.relatedPlaylists.uploads}&key=${key}`,
  );
  const items = (pl.items ?? []).filter((i) => i.snippet.title !== "Private video" && i.snippet.title !== "Deleted video");
  const stats = await videoStats(items.map((i) => i.snippet.resourceId.videoId));
  const recent: OwnVideo[] = items.map((i) => {
    const id = i.snippet.resourceId.videoId;
    const st = stats.get(id);
    const th = i.snippet.thumbnails ?? {};
    return {
      id, title: i.snippet.title, url: `https://www.youtube.com/watch?v=${id}`, thumbnail: (th.medium ?? th.high ?? th.default)?.url ?? null,
      publishedAt: i.snippet.publishedAt, views: st?.views ?? 0, likes: st?.likes ?? 0, comments: st?.comments ?? 0, seconds: st?.seconds ?? null,
    };
  });
  const data: OwnChannel = {
    id: c.id, title: c.snippet.title, url: c.snippet.customUrl ? `https://www.youtube.com/${c.snippet.customUrl}` : `https://www.youtube.com/channel/${c.id}`,
    subscribers: c.statistics.hiddenSubscriberCount ? null : Number(c.statistics.subscriberCount ?? 0),
    totalViews: Number(c.statistics.viewCount ?? 0), videoCount: Number(c.statistics.videoCount ?? 0), recent,
  };
  ownCache.set(channelId, { at: Date.now(), data });
  return data;
}

/** Forget cached YouTube numbers so the next read is fresh (a section's refresh button). */
export function clearMediaCaches(): void {
  cache.clear();
  statsCache.clear();
  ownCache.clear();
}
