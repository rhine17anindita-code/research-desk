import Parser from "rss-parser";
import { asText, stripHtml, truncate } from "../text";

import { safeFetch } from "../net";
export interface FeedItem {
  url: string;
  guid: string | null;
  title: string;
  summary: string | null;
  author: string | null;
  publishedAt: string | null;
  imageUrl: string | null;
}

export interface FetchedFeed {
  title: string | null;
  siteUrl: string | null;
  items: FeedItem[];
}

type RawItem = Record<string, unknown> & {
  link?: string; guid?: string; id?: string; title?: string; content?: string; contentSnippet?: string;
  summary?: string; creator?: string; author?: string; isoDate?: string; pubDate?: string;
  enclosure?: { url?: string; type?: string };
};

const parser = new Parser<Record<string, unknown>, RawItem>({
  timeout: 15000,
  customFields: { item: [["media:content", "mediaContent", { keepArray: false }], ["media:thumbnail", "mediaThumbnail"], ["dc:date", "dcDate"], ["description", "description"], ["media:group", "mediaGroup"]] },
});

export const USER_AGENT = "ResearchDesk/0.1 (+local research tool; RSS reader)";

export async function fetchFeedXml(url: string, timeoutMs = 15000): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await safeFetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    if ((err as Error).name === "AbortError") throw new Error(`Timed out after ${timeoutMs / 1000}s`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function parseDate(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (typeof c !== "string" || !c.trim()) continue;
    const d = new Date(c);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

function imageOf(item: RawItem): string | null {
  const mc = item.mediaContent as { $?: { url?: string } } | undefined;
  const mt = item.mediaThumbnail as { $?: { url?: string } } | undefined;
  const mg = item.mediaGroup as { "media:thumbnail"?: { $?: { url?: string } }[] } | undefined;
  if (mg?.["media:thumbnail"]?.[0]?.$?.url) return mg["media:thumbnail"][0].$.url;
  if (mc?.$?.url) return mc.$.url;
  if (mt?.$?.url) return mt.$.url;
  if (item.enclosure?.url && (item.enclosure.type ?? "").startsWith("image")) return item.enclosure.url;
  return null;
}

/** Strip channel boilerplate (disclaimers, subscribe pleas, hashtags, links) from video descriptions. */
export function cleanVideoBoilerplate(text: string): string {
  const cut = text.search(/(fair use|disclaimer|copyright|subscribe|follow us|like our|join this channel|download|whatsapp|facebook\.com|https?:\/\/|#\S+\s+#\S+|সাবস্ক্রাইব|ভিডিওটি ভালো)/i);
  const kept = (cut > 0 ? text.slice(0, cut) : cut === 0 ? "" : text).replace(/[|#=_\-\s]+$/, "").trim();
  return kept.length >= 20 ? kept : "";
}

/** Parse RSS 2.0 / Atom / RSS 1.0 (RDF) text into normalised items. Malformed items are skipped. */
export async function parseFeed(xml: string): Promise<FetchedFeed> {
  // Some publishers emit bare "&" in URLs/titles, which strict XML parsers reject.
  const cleaned = xml.replace(/&(?!(?:[a-zA-Z][a-zA-Z0-9]{1,31}|#\d{1,7}|#x[0-9a-fA-F]{1,6});)/g, "&amp;");
  const feed = await parser.parseString(cleaned);
  const items: FeedItem[] = [];
  for (const raw of feed.items ?? []) {
    const link = asText(raw.link);
    const guid = asText(raw.guid);
    const url = (link || (/^https?:/.test(guid) ? guid : "")).trim();
    const title = stripHtml(raw.title ?? "");
    if (!url || !/^https?:\/\//.test(url) || !title) continue;
    const mgDesc = (raw.mediaGroup as { "media:description"?: unknown[] } | undefined)?.["media:description"]?.[0];
    const rawSummary = asText(raw.contentSnippet) || asText(raw.description) || asText(raw.summary) || asText(raw.content) || asText(mgDesc);
    const summary = cleanVideoBoilerplate(stripHtml(rawSummary));
    items.push({
      url,
      guid: guid || asText(raw.id) || null,
      title: truncate(title, 300),
      summary: summary && summary !== title ? truncate(summary, 1200) : null,
      author: stripHtml(raw.creator ?? raw.author) || null,
      publishedAt: parseDate(raw.isoDate, raw.pubDate, raw.dcDate),
      imageUrl: imageOf(raw),
    });
  }
  return { title: feed.title ?? null, siteUrl: feed.link ?? null, items };
}
