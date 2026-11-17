import type { DB } from "../db";
import { activeChannelId, getChannel, listChannels } from "../channels";
import { nowIso } from "../ids";
import { getSetting, setSetting } from "../repo/settings";
import { upsertDaily, upsertPost } from "./store";

/**
 * Direct connection to the creator's own Instagram (professional account) and Facebook Page
 * through Meta's Graph API, with a token the creator made themselves (META_ACCESS_TOKEN in the
 * server environment — never stored in the database, never shown).
 *
 * The token can be a long-lived user token (expires after ~60 days) or a Page token made from
 * one (doesn't expire). Read-only: nothing is ever posted, replied to or changed.
 */

const API = "https://graph.facebook.com/v27.0";
/** Optional: for reading and replying to messages later (needs Meta's approval for messages from the public). */
export const META_MESSAGE_SCOPES = ["instagram_manage_messages", "pages_messaging", "pages_manage_metadata"];
export const META_SCOPES = ["pages_show_list", "pages_read_engagement", "read_insights", "instagram_basic", "instagram_manage_insights", "instagram_manage_comments", "business_management"];

export const metaConfigured = () => !!process.env.META_ACCESS_TOKEN?.trim();
const token = () => process.env.META_ACCESS_TOKEN!.trim();

class MetaError extends Error {
  constructor(message: string, public code?: number) {
    super(message);
  }
}

async function graph<T>(path: string, params: Record<string, string> = {}, tok = token()): Promise<T> {
  const u = new URL(path.startsWith("http") ? path : `${API}/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  if (!u.searchParams.has("access_token")) u.searchParams.set("access_token", tok);
  const res = await fetch(u, { signal: AbortSignal.timeout(20000) });
  const j = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number } } & T;
  if (!res.ok || j.error) {
    const code = j.error?.code;
    const msg = j.error?.message ?? `HTTP ${res.status}`;
    // Never echo the token back in errors.
    throw new MetaError(code === 190 ? "Your Meta token has expired or was revoked — make a new one (Performance → Connect Instagram & Facebook)." : msg.replace(/access_token=[^&\s]+/g, "access_token=…"), code);
  }
  return j;
}

/** Every page of a list endpoint, up to `max` items. */
async function all<T>(path: string, params: Record<string, string>, max: number, tok?: string): Promise<T[]> {
  const out: T[] = [];
  let next: string | null = null;
  let first = true;
  while ((first || next) && out.length < max) {
    const j: { data?: T[]; paging?: { next?: string } } = first ? await graph(path, params, tok) : await graph(next!, {}, tok);
    first = false;
    out.push(...(j.data ?? []));
    next = j.paging?.next ?? null;
  }
  return out.slice(0, max);
}

interface PageInfo { id: string; name: string; token: string; ig: { id: string; username: string } | null }
export interface MetaAccount { id: string; name: string; instagram: string | null }

export interface MetaStatus {
  configured: boolean;
  ok: boolean;
  error: string | null;
  tokenKind: "user" | "page" | null;
  expiresAt: string | null;
  missingScopes: string[];
  /** The Page this channel uses (and its Instagram). */
  page: { id: string; name: string } | null;
  instagram: { id: string; username: string } | null;
  /** True when this channel has picked its Page; false when it's a best guess. */
  chosen: boolean;
  /** Every Page (with its linked Instagram) the token can see. */
  pages: MetaAccount[];
  syncedAt: string | null;
  channel: { id: string; name: string };
}

type Acc = { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username?: string } };
const toInfo = (a: Acc, tok: string): PageInfo => ({ id: a.id, name: a.name, token: tok, ig: a.instagram_business_account ? { id: a.instagram_business_account.id, username: a.instagram_business_account.username ?? "" } : null });

/**
 * Which Page (and its linked Instagram) a channel uses. The channel's own choice wins; the main
 * channel falls back to a best guess (its Facebook link, else the Page with Instagram); other
 * channels get nothing until they choose, so two channels never share numbers by accident.
 */
async function resolvePage(db: DB, channelId = activeChannelId(db)): Promise<{ page: PageInfo | null; pages: MetaAccount[]; kind: "user" | "page"; chosen: boolean }> {
  // Meta says what kind of token it is; a Page token is the Page itself (its /me is the Page).
  const kind = (await graph<{ data?: { type?: string } }>("debug_token", { input_token: token() })).data?.type;
  let accounts: Acc[];
  if (kind === "PAGE") {
    const pg = await graph<Omit<Acc, "access_token">>("me", { fields: "id,name,instagram_business_account{id,username}" });
    accounts = [{ ...pg, access_token: token() }];
  } else {
    accounts = await all<Acc>("me/accounts", { fields: "id,name,access_token,instagram_business_account{id,username}", limit: "50" }, 100);
  }
  const pages = accounts.map((a) => ({ id: a.id, name: a.name, instagram: a.instagram_business_account?.username ?? null }));
  const ch = getChannel(db, channelId);
  const own = ch?.metaPageId ? accounts.find((a) => a.id === ch.metaPageId) : undefined;
  if (own) return { page: toInfo(own, own.access_token), pages, kind: kind === "PAGE" ? "page" : "user", chosen: true };
  const main = channelId === "ch_default" || listChannels(db).length === 1;
  const wanted = process.env.META_PAGE_ID?.trim();
  const fbLink = ch?.links.facebook ?? "";
  const guess = main
    ? accounts.find((a) => a.id === wanted) ?? accounts.find((a) => fbLink.includes(a.id)) ?? accounts.find((a) => a.instagram_business_account) ?? accounts[0]
    : undefined;
  return { page: guess ? toInfo(guess, guess.access_token) : null, pages, kind: kind === "PAGE" ? "page" : "user", chosen: false };
}

export async function metaStatus(db: DB): Promise<MetaStatus> {
  const base: MetaStatus = { configured: metaConfigured(), ok: false, error: null, tokenKind: null, expiresAt: null, missingScopes: [], page: null, instagram: null, chosen: false, pages: [], syncedAt: getSetting(db, "perf.meta_synced_at") || null, channel: { id: activeChannelId(db), name: getChannel(db, activeChannelId(db))?.name ?? "" } };
  if (!base.configured) return base;
  try {
    const dbg = await graph<{ data?: { is_valid?: boolean; expires_at?: number; data_access_expires_at?: number; scopes?: string[]; type?: string } }>("debug_token", { input_token: token() });
    const d = dbg.data ?? {};
    if (d.is_valid === false) return { ...base, error: "This token isn't valid any more — make a new one." };
    base.expiresAt = d.expires_at ? new Date(d.expires_at * 1000).toISOString() : null;
    base.missingScopes = META_SCOPES.filter((s) => s !== "business_management" && !(d.scopes ?? []).includes(s));
    const r = await resolvePage(db);
    base.tokenKind = r.kind;
    base.pages = r.pages;
    base.chosen = r.chosen;
    if (!r.pages.length) return { ...base, error: "The token can't see any Facebook Page. When making it, tick your Page in the list Meta shows." };
    if (!r.page) return { ...base, ok: true, error: null };
    base.page = { id: r.page.id, name: r.page.name };
    base.instagram = r.page.ig;
    return { ...base, ok: true };
  } catch (e) {
    return { ...base, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

type IgMedia = { id: string; caption?: string; media_type?: string; media_product_type?: string; permalink?: string; timestamp?: string; like_count?: number; comments_count?: number; thumbnail_url?: string; media_url?: string };

async function igInsights(m: IgMedia, tok: string): Promise<Record<string, number>> {
  const reel = m.media_product_type === "REELS";
  const tries = [
    reel ? "views,reach,saved,shares,likes,comments,total_interactions" : "views,reach,saved,shares,likes,comments,follows,total_interactions",
    "reach,saved,shares",
  ];
  for (const metric of tries) {
    try {
      const j = await graph<{ data?: { name: string; values?: { value: number }[]; total_value?: { value: number } }[] }>(`${m.id}/insights`, { metric }, tok);
      const out: Record<string, number> = {};
      for (const d of j.data ?? []) out[d.name] = d.total_value?.value ?? d.values?.[0]?.value ?? 0;
      return out;
    } catch {
      /* some media (old, album children, stories) don't support every metric */
    }
  }
  return {};
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k]);
    }
  }));
  return out;
}

export interface MetaSyncResult { instagram: number; facebook: number; comments: number; warnings: string[] }

export async function syncMeta(db: DB, opts: { maxPosts?: number; channelId?: string } = {}): Promise<MetaSyncResult> {
  if (!metaConfigured()) throw new Error("Add META_ACCESS_TOKEN to the server's environment first.");
  const channelId = opts.channelId ?? activeChannelId(db);
  const { page } = await resolvePage(db, channelId);
  if (!page) throw new Error("Choose which Facebook Page / Instagram belongs to this channel first.");
  const res: MetaSyncResult = { instagram: 0, facebook: 0, comments: 0, warnings: [] };
  const today = nowIso().slice(0, 10);
  const max = opts.maxPosts ?? 150;

  // Instagram
  if (page.ig) {
    try {
      const acct = await graph<{ followers_count?: number; media_count?: number }>(page.ig.id, { fields: "followers_count,media_count,username" }, page.token);
      upsertDaily(db, { platform: "instagram", date: today, followers: acct.followers_count ?? null }, channelId);
      const media = await all<IgMedia>(`${page.ig.id}/media`, { fields: "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,thumbnail_url,media_url", limit: "50" }, max, page.token);
      const insights = await pool(media, 5, (m) => igInsights(m, page.token));
      media.forEach((m, i) => {
        const ins = insights[i];
        const kind = m.media_product_type === "REELS" ? "reel" : m.media_product_type === "STORY" ? "story" : m.media_type === "CAROUSEL_ALBUM" ? "carousel" : m.media_type === "VIDEO" ? "video" : "post";
        upsertPost(db, {
          platform: "instagram", postId: m.id, url: m.permalink ?? null, title: (m.caption ?? "").replace(/\s+/g, " ").slice(0, 500), kind, publishedAt: m.timestamp ? new Date(m.timestamp).toISOString() : null,
          durationS: null, views: ins.views ?? null, reach: ins.reach ?? null, likes: ins.likes ?? m.like_count ?? null, comments: ins.comments ?? m.comments_count ?? null,
          shares: ins.shares ?? null, saves: ins.saved ?? null, follows: ins.follows ?? null, thumbnail: m.thumbnail_url ?? (m.media_type === "IMAGE" ? m.media_url ?? null : null), source: "api",
        }, channelId);
      });
      res.instagram = media.length;

      // Comments on the 20 most recent posts that have any.
      const ins = db.prepare(
        `INSERT INTO own_comments (id, channel_id, platform, post_id, author, text, likes, replies, published_at, fetched_at) VALUES (?, ?, 'instagram', ?, ?, ?, ?, 0, ?, ?)
         ON CONFLICT(id) DO UPDATE SET likes = excluded.likes, text = excluded.text, fetched_at = excluded.fetched_at`,
      );
      for (const m of media.filter((x) => (x.comments_count ?? 0) > 0).slice(0, 20)) {
        try {
          const cs = await all<{ id: string; text?: string; username?: string; like_count?: number; timestamp?: string }>(`${m.id}/comments`, { fields: "id,text,username,like_count,timestamp", limit: "50" }, 100, page.token);
          for (const c of cs) {
            if (!c.text?.trim()) continue;
            ins.run(`ig:${c.id}`, channelId, m.id, c.username ?? null, c.text.slice(0, 2000), c.like_count ?? 0, c.timestamp ? new Date(c.timestamp).toISOString() : null, nowIso());
            res.comments++;
          }
        } catch (e) {
          res.warnings.push(`Instagram comments: ${(e as Error).message}`);
          break;
        }
      }
    } catch (e) {
      res.warnings.push(`Instagram: ${(e as Error).message}`);
    }
  } else res.warnings.push("No Instagram account is linked to this Facebook Page (or it isn't a Professional account).");

  // Facebook Page
  try {
    const p = await graph<{ followers_count?: number; fan_count?: number }>(page.id, { fields: "followers_count,fan_count" }, page.token);
    upsertDaily(db, { platform: "facebook", date: today, followers: p.followers_count ?? p.fan_count ?? null }, channelId);
    const base = "id,message,created_time,permalink_url,shares,full_picture,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),attachments{media_type,type}";
    type FbPost = {
      id: string; message?: string; created_time?: string; permalink_url?: string; full_picture?: string; shares?: { count?: number };
      reactions?: { summary?: { total_count?: number } }; comments?: { summary?: { total_count?: number } }; attachments?: { data?: { media_type?: string; type?: string }[] };
      insights?: { data?: { name: string; values?: { value: number }[] }[] };
    };
    let posts: FbPost[];
    try {
      posts = await all<FbPost>(`${page.id}/posts`, { fields: `${base},insights.metric(post_media_view,post_total_media_view_unique,post_video_views)`, limit: "25" }, max, page.token);
    } catch (e) {
      res.warnings.push(`Facebook views unavailable (${(e as Error).message}) — reactions, comments and shares still imported.`);
      posts = await all<FbPost>(`${page.id}/posts`, { fields: base, limit: "25" }, max, page.token);
    }
    for (const fp of posts) {
      const val = (n: string) => fp.insights?.data?.find((d) => d.name === n)?.values?.[0]?.value ?? null;
      const att = fp.attachments?.data?.[0];
      const t = `${att?.media_type ?? ""} ${att?.type ?? ""}`.toLowerCase();
      upsertPost(db, {
        platform: "facebook", postId: fp.id, url: fp.permalink_url ?? null, title: (fp.message ?? "").replace(/\s+/g, " ").slice(0, 500),
        kind: /reel/.test(t) ? "reel" : /video/.test(t) ? "video" : /album/.test(t) ? "carousel" : "post", publishedAt: fp.created_time ? new Date(fp.created_time).toISOString() : null,
        durationS: null, views: val("post_media_view") ?? val("post_video_views"), reach: val("post_total_media_view_unique"), likes: fp.reactions?.summary?.total_count ?? null,
        comments: fp.comments?.summary?.total_count ?? null, shares: fp.shares?.count ?? 0, saves: null, follows: null, thumbnail: fp.full_picture ?? null, source: "api",
      }, channelId);
    }
    res.facebook = posts.length;
  } catch (e) {
    res.warnings.push(`Facebook: ${(e as Error).message}`);
  }

  setSetting(db, "perf.meta_synced_at", nowIso());
  return res;
}

/** Background sync for every channel that has a Page (the main channel uses its best guess). */
export async function syncMetaIfStale(db: DB, hours = 6) {
  if (!metaConfigured()) return null;
  const last = getSetting(db, "perf.meta_synced_at");
  if (last && Date.now() - Date.parse(last) < hours * 3_600_000) return null;
  setSetting(db, "perf.meta_synced_at", nowIso()); // also stops a broken token being retried every minute
  const out: Record<string, MetaSyncResult | string> = {};
  for (const ch of listChannels(db)) {
    if (!ch.metaPageId && ch.id !== "ch_default" && listChannels(db).length > 1) continue;
    try {
      out[ch.id] = await syncMeta(db, { channelId: ch.id });
    } catch (e) {
      out[ch.id] = (e as Error).message;
      console.error("[perf] meta sync failed", ch.name, (e as Error).message);
    }
  }
  return out;
}
