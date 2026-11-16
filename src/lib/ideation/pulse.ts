import type { DB } from "../db";
import { nowIso } from "../ids";
import { USER_AGENT } from "../ingest/rss";
import { stripHtml, truncate } from "../text";

/**
 * "Pulse": what large audiences are actually paying attention to right now, from
 * free public sources. Used to steer ideas toward mass interest. Cached for a few
 * hours in the settings table so browsing never re-fetches.
 *  - Google Trends daily trending searches (per channel country)
 *  - Wikipedia's most-read articles (yesterday, English)
 *  - Wikipedia "On this day" selected anniversaries (history hooks)
 */

export interface TrendItem { term: string; traffic: string | null; news: string[] }
export interface WikiItem { title: string; views: number; extract: string; url: string }
export interface OnThisDayItem { year: number; text: string; pages: { title: string; url: string; extract: string }[] }
export interface Pulse { trends: TrendItem[]; mostRead: WikiItem[]; onThisDay: OnThisDayItem[]; fetchedAt: string; geo: string }

const TTL_MS = 3 * 3600_000;

async function getText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json, application/rss+xml, text/xml" }, signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export async function fetchTrends(geo: string): Promise<TrendItem[]> {
  const xml = await getText(`https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`);
  const items = xml.split(/<item>/).slice(1);
  return items.slice(0, 20).map((it) => ({
    term: stripHtml(it.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ""),
    traffic: it.match(/<ht:approx_traffic>([^<]+)<\/ht:approx_traffic>/)?.[1] ?? null,
    news: [...it.matchAll(/<ht:news_item_title>([\s\S]*?)<\/ht:news_item_title>/g)].map((m) => stripHtml(m[1])).slice(0, 2),
  })).filter((t) => t.term);
}

/** Wikipedia's "featured" feed for a UTC date: most-read articles of the previous day. */
export async function fetchMostRead(date = new Date()): Promise<WikiItem[]> {
  const d = new Date(date.getTime() - 86_400_000);
  const path = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}`;
  const j = JSON.parse(await getText(`https://api.wikimedia.org/feed/v1/wikipedia/en/featured/${path}`)) as {
    mostread?: { articles?: { normalizedtitle: string; views: number; extract?: string; content_urls?: { desktop?: { page?: string } } }[] };
  };
  return (j.mostread?.articles ?? [])
    .filter((a) => !/^(Main Page|Special:|Wikipedia:|Deaths in|Portal:|File:|Template:)/.test(a.normalizedtitle))
    .slice(0, 30)
    .map((a) => ({ title: a.normalizedtitle, views: a.views, extract: truncate(a.extract ?? "", 400), url: a.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(a.normalizedtitle.replace(/ /g, "_"))}` }));
}

export async function fetchOnThisDay(date = new Date()): Promise<OnThisDayItem[]> {
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const j = JSON.parse(await getText(`https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/selected/${mm}/${dd}`)) as {
    selected?: { year: number; text: string; pages?: { normalizedtitle: string; extract?: string; content_urls?: { desktop?: { page?: string } } }[] }[];
  };
  return (j.selected ?? []).slice(0, 18).map((e) => ({
    year: e.year,
    text: e.text,
    pages: (e.pages ?? []).slice(0, 2).map((p) => ({ title: p.normalizedtitle, url: p.content_urls?.desktop?.page ?? "", extract: truncate(p.extract ?? "", 300) })),
  }));
}

let pulseOverride: Pulse | null = null;
export function setPulseForTesting(p: Pulse | null) {
  pulseOverride = p;
}

/** Cached pulse for a country. Failures yield empty lists (never blocks idea generation). */
export async function getPulse(db: DB, geo: string, force = false): Promise<Pulse> {
  if (pulseOverride) return pulseOverride;
  const key = `cache.pulse.${geo}`;
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  if (row && !force) {
    try {
      const p = JSON.parse(row.value) as Pulse;
      if (Date.now() - new Date(p.fetchedAt).getTime() < TTL_MS) return p;
    } catch {
      /* refetch */
    }
  }
  const [trends, mostRead, onThisDay] = await Promise.all([
    fetchTrends(geo).catch(() => []),
    fetchMostRead().catch(() => []),
    fetchOnThisDay().catch(() => []),
  ]);
  const pulse: Pulse = { trends, mostRead, onThisDay, fetchedAt: nowIso(), geo };
  if (trends.length || mostRead.length || onThisDay.length) {
    db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").run(
      key, JSON.stringify(pulse), nowIso(),
    );
  }
  return pulse;
}

/** Last cached pulse without any network access (for page rendering). */
export function cachedPulse(db: DB, geo: string): Pulse | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(`cache.pulse.${geo}`) as { value: string } | undefined;
  try {
    return row ? (JSON.parse(row.value) as Pulse) : null;
  } catch {
    return null;
  }
}
