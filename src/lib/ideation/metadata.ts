import type { DB } from "../db";
import { USER_AGENT } from "../ingest/rss";
import { ftsQuery, keywordQuery, stripHtml, truncate } from "../text";

/**
 * Public metadata for an inspiration link: title, author, description, thumbnail.
 * Uses official oEmbed endpoints where platforms offer them, Crossref for DOIs, and
 * a page's own <title>/OpenGraph tags otherwise. Never downloads media or full text.
 * Platforms that block anonymous access (often Instagram) simply yield less — the
 * user's own note then carries the meaning.
 */

export interface LinkMeta {
  kind: string;
  title: string | null;
  author: string | null;
  description: string | null;
  thumbnail: string | null;
}

export function detectKind(url: string): string {
  const h = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();
  if (/youtube\.com|youtu\.be/.test(h)) return "youtube";
  if (/instagram\.com/.test(h)) return "instagram";
  if (/tiktok\.com/.test(h)) return "tiktok";
  if (/(^|\.)x\.com$|twitter\.com/.test(h)) return "x";
  if (/doi\.org|arxiv\.org|ssrn\.com|jstor\.org|researchgate\.net|scholar\.google|sciencedirect\.com|springer|wiley|tandfonline|nature\.com\/articles/.test(h + url)) return "paper";
  return h ? "article" : "text";
}

export function isPublicHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (!/^https?:$/.test(u.protocol)) return false;
    const h = u.hostname;
    return !(h === "localhost" || h.endsWith(".local") || /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h === "[::1]");
  } catch {
    return false;
  }
}

export async function getText(url: string, accept = "text/html,application/json", cap = 600_000): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: accept }, signal: AbortSignal.timeout(10000), redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const reader = res.body?.getReader();
  if (!reader) return "";
  // Cap at ~600 KB: enough for <head> metadata.
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < cap) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks));
}

function metaTag(html: string, names: string[]): string | null {
  for (const n of names) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${n}["'][^>]*content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${n}["']`, "i");
    const m = html.match(re);
    if (m) return stripHtml(m[1] ?? m[2]);
  }
  return null;
}

async function oembed(endpoint: string): Promise<Partial<LinkMeta>> {
  const j = JSON.parse(await getText(endpoint, "application/json")) as { title?: string; author_name?: string; thumbnail_url?: string; html?: string };
  return { title: j.title ?? null, author: j.author_name ?? null, thumbnail: j.thumbnail_url ?? null, description: j.html ? truncate(stripHtml(j.html), 600) : null };
}

export async function fetchLinkMeta(url: string): Promise<LinkMeta> {
  const kind = detectKind(url);
  const base: LinkMeta = { kind, title: null, author: null, description: null, thumbnail: null };
  if (!isPublicHttpUrl(url)) return base;
  const tries: (() => Promise<Partial<LinkMeta>>)[] = [];
  if (kind === "youtube") tries.push(() => oembed(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`));
  if (kind === "tiktok") tries.push(() => oembed(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`));
  if (kind === "x") tries.push(() => oembed(`https://publish.twitter.com/oembed?omit_script=true&url=${encodeURIComponent(url)}`));
  const doi = url.match(/10\.\d{4,9}\/[^\s?#]+/)?.[0];
  if (doi)
    tries.push(async () => {
      const j = JSON.parse(await getText(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, "application/json")) as {
        message?: { title?: string[]; author?: { given?: string; family?: string }[]; abstract?: string; "container-title"?: string[] };
      };
      const m = j.message ?? {};
      return {
        title: m.title?.[0] ?? null,
        author: (m.author ?? []).slice(0, 4).map((a) => [a.given, a.family].filter(Boolean).join(" ")).join(", ") || null,
        description: m.abstract ? truncate(stripHtml(m.abstract), 1200) : m["container-title"]?.[0] ?? null,
      };
    });
  // Page metadata as the general fallback (also fills a YouTube description).
  tries.push(async () => {
    const html = await getText(url);
    return {
      title: metaTag(html, ["og:title", "twitter:title"]) ?? (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ? stripHtml(html.match(/<title[^>]*>([^<]+)<\/title>/i)![1]) : null),
      description: metaTag(html, ["og:description", "description", "twitter:description"]),
      author: metaTag(html, ["author", "article:author", "og:site_name"]),
      thumbnail: metaTag(html, ["og:image", "twitter:image"]),
    };
  });
  const out = { ...base };
  for (const t of tries) {
    try {
      const r = await t();
      if (r.title && /^(instagram|tiktok|youtube|x|twitter|facebook|log in|login|sign in|just a moment\.*)$/i.test(r.title.trim())) r.title = null;
      for (const k of ["title", "author", "description", "thumbnail"] as const) if (!out[k] && r[k]) out[k] = truncate(r[k]!, k === "description" ? 1500 : 400);
    } catch {
      /* try the next method */
    }
    if (out.title && out.description) break;
  }
  return out;
}

/** Stories in the local database related to an inspiration's text (free, local). */
export function matchStories(db: DB, text: string, limit = 5): string[] {
  const q = ftsQuery(keywordQuery(text, 8), "any");
  if (!q) return [];
  return (db.prepare("SELECT ref_id FROM search_index WHERE kind = 'cluster' AND search_index MATCH ? ORDER BY bm25(search_index, 0, 0, 3.0, 1.0) LIMIT ?").all(q, limit) as { ref_id: string }[]).map((r) => r.ref_id);
}
