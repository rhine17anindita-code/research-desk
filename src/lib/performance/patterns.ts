import type { DB } from "../db";
import { activeChannel, termMatcher } from "../channels";
import { BD } from "../ideation/talk";
import { listComments, listDaily, listPosts, PERF_PLATFORMS, type OwnPost, type PerfPlatform } from "./store";

/**
 * What works for this creator, from their own numbers (free, local). Every post is compared
 * with that platform's typical post (median), so a 2× means "twice your usual" — fair across
 * platforms and account sizes. Posts younger than 3 days are left out of the patterns.
 */

export const LABEL: Record<PerfPlatform, string> = { youtube: "YouTube", instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok" };

const metricOf = (p: OwnPost) => p.views ?? p.reach ?? p.likes ?? null;
const median = (a: number[]) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const age = (p: OwnPost) => (p.publishedAt ? (Date.now() - Date.parse(p.publishedAt)) / 86_400_000 : 999);

export interface PlatformSummary {
  platform: PerfPlatform; label: string; posts: number; recentPosts: number; recentViews: number; prevViews: number; totalViews: number; typical: number;
  metric: "views" | "reach" | "likes"; followers: number | null; followersChange: number | null; lastPostAt: string | null; lastUpdated: string | null;
}
export interface RankedPost extends OwnPost { metric: number; lift: number }
export interface Pattern { platform: PerfPlatform | "all"; label: string; lift: number; n: number; kind: "good" | "bad" }
export interface Performance { summaries: PlatformSummary[]; top: RankedPost[]; flops: RankedPost[]; latest: RankedPost[]; patterns: Pattern[]; total: number }

const BD_HOUR = (iso: string) => (new Date(iso).getUTCHours() + 6) % 24; // Bangladesh time
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function features(p: OwnPost, boost: (t: string) => string[]): string[] {
  const t = p.title ?? "";
  const f: string[] = [];
  if (p.kind) f.push(`Format: ${({ short: "Shorts", video: "long videos", reel: "Reels", post: "photo/text posts", carousel: "carousels", story: "stories", live: "lives" } as Record<string, string>)[p.kind] ?? p.kind}`);
  if (t) {
    if (/\?/.test(t)) f.push("A question in the title");
    if (/\d/.test(t)) f.push("A number in the title");
    if (/^(why|how|what|who)\b/i.test(t)) f.push("Title starts with why/how/what/who");
    if (BD.test(t)) f.push("About Bangladesh");
    if (/\b(india|modi|delhi|indian)\b/i.test(t)) f.push("About India");
    if (/\b(trump|america|usa|u\.s\.|biden)\b/i.test(t)) f.push("About the US");
    if (/\b(china|chinese|beijing|xi)\b/i.test(t)) f.push("About China");
    if (/\b(israel|gaza|iran|palestin|saudi|middle east)\b/i.test(t)) f.push("About the Middle East");
    if (/\b(pakistan)\b/i.test(t)) f.push("About Pakistan");
    for (const b of boost(t).slice(0, 2)) f.push(`Focus topic: ${b}`);
    f.push(t.length <= 50 ? "Short title (≤50 characters)" : "Long title (50+ characters)");
  }
  if (p.durationS != null && ["short", "video", "reel"].includes(p.kind ?? "")) {
    const d = p.durationS;
    f.push(d < 30 ? "Under 30 seconds" : d <= 60 ? "30–60 seconds" : d <= 180 ? "1–3 minutes" : d <= 600 ? "3–10 minutes" : "Over 10 minutes");
  }
  if (p.publishedAt) {
    const h = BD_HOUR(p.publishedAt);
    f.push(`Posted ${h >= 6 && h < 12 ? "in the morning" : h < 17 && h >= 12 ? "in the afternoon" : h >= 17 && h < 22 ? "in the evening" : "late at night"} (BD time)`);
    f.push(`Posted on a ${DAYS[new Date(Date.parse(p.publishedAt) + 6 * 3_600_000).getUTCDay()]}`);
  }
  return f;
}

export function performance(db: DB): Performance {
  const ch = activeChannel(db);
  const boost = termMatcher(ch.boostTerms);
  const summaries: PlatformSummary[] = [];
  const ranked: RankedPost[] = [];
  const patterns: Pattern[] = [];
  let total = 0;

  for (const platform of PERF_PLATFORMS) {
    const posts = listPosts(db, { platform }).filter((p) => metricOf(p) != null);
    const daily = listDaily(db, platform, 120);
    if (!posts.length && !daily.length) continue;
    total += posts.length;
    const metric = posts.some((p) => p.views != null) ? "views" : posts.some((p) => p.reach != null) ? "reach" : "likes";
    const mature = posts.filter((p) => age(p) >= 3);
    const typical = median((mature.length >= 3 ? mature : posts).map((p) => metricOf(p)!));
    const in30 = posts.filter((p) => age(p) <= 30);
    const prev30 = posts.filter((p) => age(p) > 30 && age(p) <= 60);
    const fl = daily.filter((d) => d.followers != null);
    summaries.push({
      platform, label: LABEL[platform], posts: posts.length, recentPosts: in30.length, recentViews: in30.reduce((n, p) => n + (metricOf(p) ?? 0), 0),
      prevViews: prev30.reduce((n, p) => n + (metricOf(p) ?? 0), 0), totalViews: posts.reduce((n, p) => n + (metricOf(p) ?? 0), 0), typical, metric, followers: fl.at(-1)?.followers ?? null,
      followersChange: fl.length >= 2 ? (fl.at(-1)!.followers ?? 0) - (fl[0].followers ?? 0) : null, lastPostAt: posts[0]?.publishedAt ?? null,
      lastUpdated: posts.reduce<string | null>((m, p) => (!m || p.updatedAt > m ? p.updatedAt : m), null),
    });
    for (const p of posts) ranked.push({ ...p, metric: metricOf(p)!, lift: typical ? metricOf(p)! / typical : 0 });

    // Patterns need enough mature posts to mean anything.
    if (mature.length < 6) continue;
    const groups = new Map<string, number[]>();
    for (const p of mature) for (const f of features(p, boost)) (groups.get(f) ?? groups.set(f, []).get(f)!).push(metricOf(p)! / (typical || 1));
    for (const [label, lifts] of groups) {
      if (lifts.length < 3 || lifts.length > mature.length - 2) continue; // too rare, or nearly everything (no contrast)
      const lift = median(lifts);
      if (Math.abs(lift - 1) < 0.25) continue;
      patterns.push({ platform, label, lift, n: lifts.length, kind: lift > 1 ? "good" : "bad" });
    }
  }

  const mature = ranked.filter((p) => age(p) >= 3);
  return {
    summaries,
    top: [...mature].sort((a, b) => b.lift - a.lift).slice(0, 8),
    flops: [...mature].filter((p) => age(p) <= 120 && p.lift < 0.8).sort((a, b) => a.lift - b.lift).slice(0, 5),
    latest: [...ranked].sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")).slice(0, 10),
    patterns: patterns.sort((a, b) => Math.abs(Math.log(b.lift)) * Math.sqrt(b.n) - Math.abs(Math.log(a.lift)) * Math.sqrt(a.n)).slice(0, 24),
    total,
  };
}

const x = (n: number) => `${n >= 10 ? Math.round(n) : n.toFixed(1)}×`;

/** A compact text version for AI prompts (ideas, scripts, the strategist). Empty when there's no data. */
export function performanceBrief(db: DB, perf = performance(db)): string {
  if (!perf.total) return "";
  const lines: string[] = [];
  for (const s of perf.summaries)
    lines.push(`${s.label}: ${s.posts} posts; typical post ${Math.round(s.typical).toLocaleString()} ${s.metric}; last 30 days ${s.recentPosts} posts, ${s.recentViews.toLocaleString()} ${s.metric}${s.followers != null ? `; ${s.followers.toLocaleString()} followers` : ""}.`);
  if (perf.top.length) lines.push(`Best performers (× their platform's typical post):\n${perf.top.slice(0, 6).map((p) => `- ${x(p.lift)} ${LABEL[p.platform]} ${p.kind ?? ""}: “${p.title.slice(0, 110)}”`).join("\n")}`);
  if (perf.flops.length) lines.push(`Weakest recent:\n${perf.flops.slice(0, 4).map((p) => `- ${x(p.lift)} ${LABEL[p.platform]} ${p.kind ?? ""}: “${p.title.slice(0, 110)}”`).join("\n")}`);
  if (perf.patterns.length) lines.push(`Patterns (median vs typical, n = posts):\n${perf.patterns.slice(0, 14).map((p) => `- ${LABEL[p.platform as PerfPlatform] ?? p.platform}: ${p.label} → ${x(p.lift)} (n=${p.n})`).join("\n")}`);
  return lines.join("\n");
}

/** Free scan of comments: requests for topics and questions, most-liked first. */
export function commentScan(db: DB) {
  const all = listComments(db, { limit: 1500 });
  const REQ = /\b(make|do) (a |one |another )?(video|vid|episode|part)\b|\b(video|part 2|episode) (on|about)\b|\b(cover|talk about|discuss|explain|analy[sz]e|react to)\b|\bnext (video|topic)\b|ভিডিও (বানান|করেন|চাই)|নিয়ে (ভিডিও|বলেন|কথা বলেন)/i;
  const titles = new Map(listPosts(db, { platform: "youtube", limit: 500 }).map((p) => [p.postId, p.title]));
  const pick = (f: (t: string) => boolean) =>
    all.filter((c) => f(c.text)).sort((a, b) => b.likes - a.likes).slice(0, 8).map((c) => ({ ...c, video: titles.get(c.postId) ?? null }));
  return { count: all.length, requests: pick((t) => REQ.test(t) && t.length > 12), questions: pick((t) => /\?|^(why|how|what|who|is|are|can|kí|কেন|কি|কী)\b/i.test(t) && !REQ.test(t)) };
}
