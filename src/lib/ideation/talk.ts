import type { DB } from "../db";
import { activeChannel, termMatcher } from "../channels";
import { videoStats, youtubeId } from "../media";
import { jaccard, uniqueTokens } from "../text";

/**
 * Talk shows & podcasts radar. Recent episodes from Bangladeshi and international
 * talk shows/podcasts, ranked by how promising they are as raw material:
 * the channel's focus terms, Bangladesh relevance, whether the topic is NOT already
 * in the headlines (hidden information), and — with a YouTube key — how well the
 * episode is doing against that show's usual numbers.
 */
export interface TalkEpisode {
  articleId: string;
  title: string;
  url: string;
  show: string;
  language: string;
  publishedAt: string | null;
  thumbnail: string | null;
  summary: string | null;
  views: number | null;
  breakout: number | null;
  short: boolean;
  inNews: boolean;
  /** English title (free translation from your Mac) for Bangla episodes. */
  titleEn: string | null;
  score: number;
  reasons: string[];
}

interface Row { id: string; title: string; url: string; summary: string | null; publisher: string | null; published_at: string | null; image_url: string | null; language: string | null; feed_name: string }

export const BD = /bangladesh|dhaka|bangla|bnp|jamaat|awami|hasina|yunus|tarique|rohingya|chittagong|chattogram|sylhet|বাংলাদেশ|ঢাকা|বিএনপি|জামায়াত|আওয়ামী|হাসিনা|ইউনূস|তারেক/i;

export async function talkEpisodes(db: DB, opts: { limit?: number; days?: number; language?: "bn" | "en" } = {}): Promise<TalkEpisode[]> {
  const ch = activeChannel(db);
  const rows = db
    .prepare(
      `SELECT a.id, a.title, a.url, a.summary, a.publisher, a.published_at, a.image_url, f.language, f.name AS feed_name
       FROM articles a JOIN feeds f ON f.id = a.feed_id
       WHERE f.category = 'talk' AND f.enabled = 1
         AND (f.id IN (SELECT feed_id FROM channel_feeds WHERE channel_id = ?) OR NOT EXISTS (SELECT 1 FROM channel_feeds WHERE feed_id = f.id))
         AND f.id NOT IN (SELECT feed_id FROM channel_talk_off WHERE channel_id = ?)
         AND COALESCE(a.published_at, a.fetched_at) >= strftime('%Y-%m-%dT%H:%M:%SZ', 'now', ?)
         ${opts.language ? "AND COALESCE(f.language, 'en') = ?" : ""}
       ORDER BY COALESCE(a.published_at, a.fetched_at) DESC LIMIT 300`,
    )
    .all(...[ch.id, ch.id, `-${opts.days ?? 5} days`, ...(opts.language ? [opts.language] : [])]) as Row[];
  if (!rows.length) return [];

  // Numbers (best effort): views, and length to tell clips/Shorts from full episodes.
  const ids = rows.map((r) => youtubeId(r.url)).filter((x): x is string => !!x);
  const stats = new Map<string, { views: number; seconds: number | null }>();
  try {
    for (let i = 0; i < Math.min(ids.length, 200); i += 50) for (const [k, v] of await videoStats(ids.slice(i, i + 50))) stats.set(k, v);
  } catch {
    /* no key / quota */
  }
  const byShow = new Map<string, number[]>();
  for (const r of rows) {
    const v = stats.get(youtubeId(r.url) ?? "");
    if (v) (byShow.get(r.feed_name) ?? byShow.set(r.feed_name, []).get(r.feed_name)!).push(v.views);
  }
  const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] ?? 0;

  // What's already in the headlines (last 4 days), to spot topics the news hasn't picked up.
  const headlines = (db.prepare("SELECT headline FROM clusters WHERE last_updated_at >= strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-4 days') ORDER BY source_count DESC LIMIT 400").all() as { headline: string }[])
    .map((h) => new Set(uniqueTokens(h.headline)));
  const boost = termMatcher(ch.boostTerms);
  const mute = termMatcher(ch.muteTerms);

  const out: TalkEpisode[] = rows.map((r) => {
    const id = youtubeId(r.url) ?? "";
    const st = stats.get(id);
    const short = r.url.includes("/shorts/") || (st?.seconds != null && st.seconds <= 180);
    const text = `${r.title} ${r.summary ?? ""}`;
    const reasons: string[] = [];
    let score = 0;
    const ageH = r.published_at ? (Date.now() - new Date(r.published_at).getTime()) / 3_600_000 : 96;
    score += 7 * Math.pow(0.5, ageH / 12); // fresh first: worth 7 when new, half that after 12 hours
    const b = boost(text);
    if (b.length) { score += Math.min(6, b.length * 2); reasons.push(`Your focus: ${b.slice(0, 3).join(", ")}`); }
    const m = mute(text);
    if (m.length) score -= 5;
    if (BD.test(text) || r.language === "bn") { score += 2; if (r.language !== "bn") reasons.push("Touches Bangladesh"); }
    // Headlines are English, so only English titles can be checked against them.
    const latin = (r.title.match(/[A-Za-z]/g)?.length ?? 0) / Math.max(1, r.title.replace(/\s/g, "").length) > 0.6;
    const toks = new Set(uniqueTokens(r.title));
    const inNews = latin && toks.size >= 3 && headlines.some((h) => jaccard(h, toks) >= 0.3);
    if (latin && !inNews && toks.size >= 3) { score += 1.5; reasons.push("Not in today's headlines"); }
    if (/\blive\b|সরাসরি/i.test(r.title)) score -= 3; // live streams and parliament feeds are rarely a story
    let breakout: number | null = null;
    const arr = byShow.get(r.feed_name);
    if (st && arr && arr.length >= 3) {
      const med = median(arr);
      breakout = med > 0 ? st.views / med : null;
      if (breakout && breakout >= 1.5 && st.views >= 5000) { score += Math.min(4, Math.log2(breakout) * 2); reasons.push(`${breakout.toFixed(1)}× this show's usual views`); }
    }
    if (short) score -= 1.5; // clips are fine, full conversations are richer
    return {
      articleId: r.id, title: r.title, url: r.url, show: r.feed_name.replace(/ \(YouTube\)$/, ""), language: r.language ?? "en", publishedAt: r.published_at,
      thumbnail: r.image_url, summary: r.summary, views: st?.views ?? null, breakout, short, inNews, score, reasons,
      titleEn: (db.prepare("SELECT json_extract(parts, '$[0]') AS t FROM translations WHERE kind = 'article' AND ref_id = ?").get(r.id) as { t: string | null } | undefined)?.t ?? null,
    };
  });

  // Variety: at most 2 episodes per show in the top list.
  const perShow = new Map<string, number>();
  return out
    .sort((a, b) => b.score - a.score)
    .filter((e) => {
      const n = perShow.get(e.show) ?? 0;
      perShow.set(e.show, n + 1);
      return n < 2;
    })
    .slice(0, opts.limit ?? 12);
}

/** Every talk show, and whether it's on for the active channel. */
export function talkShows(db: DB): { id: string; name: string; language: string; on: boolean }[] {
  const ch = activeChannel(db);
  return (db.prepare(
    `SELECT f.id, f.name, COALESCE(f.language, 'en') AS language, NOT EXISTS (SELECT 1 FROM channel_talk_off o WHERE o.channel_id = ? AND o.feed_id = f.id) AS on_
     FROM feeds f WHERE f.category = 'talk' AND f.enabled = 1 ORDER BY language, f.name`,
  ).all(ch.id) as { id: string; name: string; language: string; on_: number }[]).map((r) => ({ id: r.id, name: r.name.replace(/ \(YouTube\)$/, ""), language: r.language, on: !!r.on_ }));
}

export function setTalkShow(db: DB, feedId: string, on: boolean): void {
  const ch = activeChannel(db);
  if (on) db.prepare("DELETE FROM channel_talk_off WHERE channel_id = ? AND feed_id = ?").run(ch.id, feedId);
  else db.prepare("INSERT OR IGNORE INTO channel_talk_off (channel_id, feed_id) VALUES (?, ?)").run(ch.id, feedId);
}
