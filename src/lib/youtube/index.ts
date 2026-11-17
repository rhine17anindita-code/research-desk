import type { DB } from "../db";
import { parseJson } from "../db";
import { newId, nowIso } from "../ids";
import { json, resolveYoutubeChannel, videoStats, youtubeConfigured } from "../media";
import { jaccard, uniqueTokens } from "../text";
import { getProduction, updateProduction } from "../production";
import { FORMATS } from "./guide";

/**
 * YouTube Studio: the channels being built, the plan to monetisation, competitors and missed
 * angles, packaging tools and per-project checklists. Uses the YouTube API key where data is
 * needed; everything else is rules and the playbook. No AI.
 */

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

export interface YtChannel {
  id: string; name: string; handle: string; niche: string; deskChannelId: string | null; youtubeId: string | null; status: string; priority: number;
  positioning: string; audience: string; pillars: string[]; formats: string[]; cadence: string; notes: string; watchHours: number | null;
}
type R = Record<string, unknown>;
const ch = (r: R): YtChannel => ({
  id: String(r.id), name: String(r.name), handle: String(r.handle), niche: String(r.niche), deskChannelId: (r.desk_channel_id as string) ?? null, youtubeId: (r.youtube_id as string) ?? null,
  status: String(r.status), priority: Number(r.priority), positioning: String(r.positioning), audience: String(r.audience), pillars: parseJson(String(r.pillars), []),
  formats: parseJson(String(r.formats), []), cadence: String(r.cadence), notes: String(r.notes), watchHours: (r.watch_hours as number) ?? null,
});

const SEED: Omit<YtChannel, "id">[] = [
  {
    name: "Anindita Rhine", handle: "@aninditarhine", niche: "Bangladesh and the world, explained", deskChannelId: "ch_default", youtubeId: "UCIsWcCRLew0d0T11q1f2_ug", status: "active", priority: 1,
    positioning: "Smart, sharp explainers on what's really going on in Bangladesh and how the world affects it — for young Bangladeshis who want to understand, not just scroll.",
    audience: "18–30, Bangladesh and diaspora, English-speaking students and young professionals.",
    pillars: ["Bangladesh politics, explained", "Geopolitics & maps (series)", "Money & economy (series)", "The real story behind (history series)"],
    formats: ["desk-explainer", "map-explainer", "doc-breakdown", "weekly-roundup", "shorts-cutdown", "standalone-short", "live"], cadence: "1 long video a week + 4–5 Shorts",
    notes: "Main channel: everything goes here first. Geopolitics, Money and History start as named series here; spin them out when a series proves itself.", watchHours: null,
  },
  {
    name: "Rhine Reviews", handle: "", niche: "Books, film and culture — the stories behind them", deskChannelId: "ch_culture", youtubeId: null, status: "planned", priority: 2,
    positioning: "Reviews and deep-dives on books, film and culture, with the history and context nobody else gives.", audience: "18–30 readers and film fans in Bangladesh and South Asia.",
    pillars: ["The story behind the film/book", "Reviews with context", "Bengali culture & history"], formats: ["desk-explainer", "history-story", "list-video", "shorts-cutdown"],
    cadence: "1 long video every 2 weeks, once the main channel's weekly rhythm is steady", notes: "Start after 4 steady weeks on the main channel.", watchHours: null,
  },
  { name: "History (working title)", handle: "", niche: "Bangladesh & South Asia history, myths and origins", deskChannelId: null, youtubeId: null, status: "later", priority: 3, positioning: "", audience: "", pillars: ["Myths everyone believes", "Origins of places and names", "Forgotten events"], formats: ["history-story", "map-explainer", "list-video"], cadence: "", notes: "Run as ‘The real story behind…’ series on the main channel first.", watchHours: null },
  { name: "Money (working title)", handle: "", niche: "Money and the economy, explained for young Bangladeshis", deskChannelId: null, youtubeId: null, status: "later", priority: 4, positioning: "", audience: "", pillars: ["Prices & inflation", "Taka, banks & remittances", "Careers & salaries"], formats: ["money-explainer", "doc-breakdown", "list-video"], cadence: "", notes: "Run as ‘Money Minutes’ series on the main channel first (sponsor-friendly).", watchHours: null },
  { name: "Geopolitics (working title)", handle: "", niche: "Maps-led explainers on South Asia and the world", deskChannelId: null, youtubeId: null, status: "later", priority: 5, positioning: "", audience: "", pillars: ["Neighbours: India, China, Myanmar", "Borders, rivers & trade", "The world & Bangladesh"], formats: ["map-explainer", "desk-explainer"], cadence: "", notes: "Run as a map-explainer series on the main channel first.", watchHours: null },
];

function seed(db: DB) {
  if (db.prepare("SELECT 1 FROM yt_channels LIMIT 1").get()) return;
  const now = nowIso();
  const ins = db.prepare(
    `INSERT INTO yt_channels (id, name, handle, niche, desk_channel_id, youtube_id, status, priority, positioning, audience, pillars, formats, cadence, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const c of SEED) {
    const deskOk = c.deskChannelId && db.prepare("SELECT 1 FROM channels WHERE id = ?").get(c.deskChannelId) ? c.deskChannelId : null;
    ins.run(newId("yt"), c.name, c.handle, c.niche, deskOk, c.youtubeId, c.status, c.priority, c.positioning, c.audience, JSON.stringify(c.pillars), JSON.stringify(c.formats), c.cadence, c.notes, now, now);
  }
}

export function listYtChannels(db: DB): YtChannel[] {
  seed(db);
  return (db.prepare("SELECT * FROM yt_channels ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'launching' THEN 1 WHEN 'planned' THEN 2 ELSE 3 END, priority").all() as R[]).map(ch);
}
export function getYtChannel(db: DB, id: string): YtChannel | null {
  const r = db.prepare("SELECT * FROM yt_channels WHERE id = ?").get(id) as R | undefined;
  return r ? ch(r) : null;
}

const COLS: Record<string, string> = { name: "name", handle: "handle", niche: "niche", deskChannelId: "desk_channel_id", youtubeId: "youtube_id", status: "status", priority: "priority", positioning: "positioning", audience: "audience", pillars: "pillars", formats: "formats", cadence: "cadence", notes: "notes", watchHours: "watch_hours" };
export function saveYtChannel(db: DB, id: string | null, data: Partial<YtChannel>): YtChannel {
  seed(db);
  const now = nowIso();
  const rowId = id ?? newId("yt");
  if (!id) db.prepare("INSERT INTO yt_channels (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)").run(rowId, data.name?.trim() || "New channel", now, now);
  for (const [k, v] of Object.entries(data)) {
    const col = COLS[k];
    if (!col) continue;
    db.prepare(`UPDATE yt_channels SET ${col} = ?, updated_at = ? WHERE id = ?`).run(Array.isArray(v) ? JSON.stringify(v) : (v as never) ?? null, now, rowId);
  }
  return getYtChannel(db, rowId)!;
}
export function deleteYtChannel(db: DB, id: string) {
  db.prepare("DELETE FROM yt_channels WHERE id = ?").run(id);
  db.prepare("DELETE FROM yt_comp_videos WHERE competitor_id IN (SELECT id FROM yt_competitors WHERE yt_channel_id = ?)").run(id);
  db.prepare("DELETE FROM yt_competitors WHERE yt_channel_id = ?").run(id);
}

// ---------------------------------------------------------------------------
// Checklists
// ---------------------------------------------------------------------------

export function checks(db: DB, scope: string): string[] {
  return (db.prepare("SELECT key FROM yt_checks WHERE scope = ?").all(scope) as { key: string }[]).map((r) => r.key);
}
export function setCheck(db: DB, scope: string, key: string, done: boolean) {
  if (done) db.prepare("INSERT OR REPLACE INTO yt_checks (scope, key, done_at) VALUES (?, ?, ?)").run(scope, key, nowIso());
  else db.prepare("DELETE FROM yt_checks WHERE scope = ? AND key = ?").run(scope, key);
}

export { LAUNCH } from "./guide";

// ---------------------------------------------------------------------------
// Plan: progress to monetisation and a weekly schedule
// ---------------------------------------------------------------------------

export interface YppProgress { subscribers: number | null; watchHours: number | null; shortsViews90d: number; longVideos: number; shorts: number; lastUpload: string | null }

export function yppProgress(db: DB, yt: YtChannel): YppProgress {
  const desk = yt.deskChannelId;
  const subs = desk ? (db.prepare("SELECT followers FROM own_daily WHERE channel_id = ? AND platform = 'youtube' AND followers IS NOT NULL ORDER BY date DESC LIMIT 1").get(desk) as { followers: number } | undefined)?.followers ?? null : null;
  const posts = desk ? (db.prepare("SELECT kind, views, published_at FROM own_posts WHERE channel_id = ? AND platform = 'youtube'").all(desk) as { kind: string | null; views: number | null; published_at: string | null }[]) : [];
  const since = Date.now() - 90 * 86_400_000;
  return {
    subscribers: subs,
    watchHours: yt.watchHours,
    shortsViews90d: posts.filter((p) => p.kind === "short" && p.published_at && Date.parse(p.published_at) >= since).reduce((n, p) => n + (p.views ?? 0), 0),
    longVideos: posts.filter((p) => p.kind === "video").length,
    shorts: posts.filter((p) => p.kind === "short").length,
    lastUpload: posts.map((p) => p.published_at).filter(Boolean).sort().at(-1) ?? null,
  };
}

export interface WeekBlock { day: string; tasks: string[]; hours: number }

/** A realistic solo week for the main channel (about 20 hours), built from the format times. */
export function weeklyPlan(hoursPerWeek = 20): { blocks: WeekBlock[]; summary: string; rules: string[] } {
  const long = FORMATS.find((f) => f.id === "desk-explainer")!;
  const blocks: WeekBlock[] = [
    { day: "Monday", tasks: ["Pick the week's long video from Stories worth building / missed angles", "Validate: title + thumbnail sketch, competitor check", "Make it a project; get full articles"], hours: 3 },
    { day: "Tuesday", tasks: ["Research: answer the 5 viewer questions", "Hooks → outline (approve the beats)"], hours: 3 },
    { day: "Wednesday", tasks: ["Draft the script in your voice; read aloud, cut 15%", "Write 2 standalone Shorts scripts"], hours: 3 },
    { day: "Thursday", tasks: ["Shoot day: long video + 2 Shorts (one setup)", "Desk B-roll and screen recordings"], hours: 3.5 },
    { day: "Friday", tasks: ["Edit the long video in CapCut (rough cut → tighten → visuals → captions → sound)"], hours: 4 },
    { day: "Saturday", tasks: ["Thumbnail (2–3 versions), title, description, chapters", "Upload & schedule the long video for the evening", "Cut 3 Shorts from it"], hours: 2.5 },
    { day: "Sunday", tasks: ["Promote on Facebook/Instagram", "Reply to comments", "48-hour review of last week's video; one lesson"], hours: 1 },
  ];
  const total = blocks.reduce((n, b) => n + b.hours, 0);
  const scale = hoursPerWeek / total;
  return {
    blocks: blocks.map((b) => ({ ...b, hours: Math.round(b.hours * scale * 2) / 2 })),
    summary: `About ${hoursPerWeek} hours: 1 long ${long.name.split(" (")[0].toLowerCase()} (8–12 min) + 3 Shorts cut from it + 2 standalone Shorts, every week on the main channel.`,
    rules: [
      "One channel first. Monetisation fast means concentrating watch hours on the main channel; History, Money and Geopolitics start there as named series.",
      "Long videos every single week — Shorts don't count towards the 4,000 watch hours.",
      "Add Rhine Reviews after 4 weeks in a row of hitting the weekly plan (1 long every 2 weeks).",
      "Spin a series out into its own channel only when several of its episodes beat your usual views by 2× or more.",
      "Batch: on shoot day film the long video and 2 Shorts in one setup.",
    ],
  };
}

// ---------------------------------------------------------------------------
// Competitors & missed angles
// ---------------------------------------------------------------------------

export interface Competitor { id: string; ytChannelId: string; youtubeId: string; name: string; notes: string; fetchedAt: string | null; videos: number; median: number }
export interface CompVideo { videoId: string; competitor: string; title: string; publishedAt: string | null; views: number; seconds: number | null; multiple: number; thumbnail: string | null; url: string }

export async function addCompetitor(db: DB, ytChannelId: string, link: string): Promise<Competitor> {
  if (!youtubeConfigured()) throw new Error("Needs the YouTube API key");
  const id = /^UC[\w-]{22}$/.test(link.trim()) ? link.trim() : await resolveYoutubeChannel(link.trim().startsWith("@") ? `https://www.youtube.com/${link.trim()}` : link.trim());
  if (!id) throw new Error("Couldn't find that YouTube channel — paste its link or @handle");
  if (db.prepare("SELECT 1 FROM yt_competitors WHERE yt_channel_id = ? AND youtube_id = ?").get(ytChannelId, id)) throw new Error("Already tracking that channel");
  const j = await json<{ items?: { snippet: { title: string } }[] }>(`https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${id}&key=${encodeURIComponent(process.env.YOUTUBE_API_KEY!)}`);
  const cid = newId("yc");
  db.prepare("INSERT INTO yt_competitors (id, yt_channel_id, youtube_id, name, created_at) VALUES (?, ?, ?, ?, ?)").run(cid, ytChannelId, id, j.items?.[0]?.snippet.title ?? id, nowIso());
  await refreshCompetitor(db, cid);
  return listCompetitors(db, ytChannelId).find((c) => c.id === cid)!;
}

export async function refreshCompetitor(db: DB, competitorId: string) {
  const c = db.prepare("SELECT * FROM yt_competitors WHERE id = ?").get(competitorId) as { id: string; youtube_id: string } | undefined;
  if (!c || !youtubeConfigured()) return;
  const key = encodeURIComponent(process.env.YOUTUBE_API_KEY!);
  const uploads = "UU" + c.youtube_id.slice(2);
  const pl = await json<{ items?: { snippet: { title: string; publishedAt: string; resourceId: { videoId: string }; thumbnails?: Record<string, { url: string }> } }[] }>(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=40&playlistId=${uploads}&key=${key}`,
  );
  const items = (pl.items ?? []).filter((i) => !/^(Private|Deleted) video$/.test(i.snippet.title));
  const stats = await videoStats(items.map((i) => i.snippet.resourceId.videoId));
  const ins = db.prepare(
    `INSERT INTO yt_comp_videos (video_id, competitor_id, title, published_at, views, comments, seconds, thumbnail, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(video_id) DO UPDATE SET views = excluded.views, comments = excluded.comments, fetched_at = excluded.fetched_at`,
  );
  for (const i of items) {
    const st = stats.get(i.snippet.resourceId.videoId);
    const th = i.snippet.thumbnails ?? {};
    ins.run(i.snippet.resourceId.videoId, c.id, i.snippet.title, i.snippet.publishedAt, st?.views ?? null, st?.comments ?? null, st?.seconds ?? null, (th.medium ?? th.default)?.url ?? null, nowIso());
  }
  db.prepare("UPDATE yt_competitors SET fetched_at = ? WHERE id = ?").run(nowIso(), c.id);
}

export async function refreshAllCompetitors(db: DB, ytChannelId: string) {
  for (const c of db.prepare("SELECT id FROM yt_competitors WHERE yt_channel_id = ?").all(ytChannelId) as { id: string }[]) await refreshCompetitor(db, c.id).catch(() => {});
}

const median = (a: number[]) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0);

export function listCompetitors(db: DB, ytChannelId: string): Competitor[] {
  return (db.prepare("SELECT * FROM yt_competitors WHERE yt_channel_id = ? ORDER BY name").all(ytChannelId) as R[]).map((r) => {
    const vids = db.prepare("SELECT views FROM yt_comp_videos WHERE competitor_id = ? AND views IS NOT NULL").all(r.id) as { views: number }[];
    return { id: String(r.id), ytChannelId, youtubeId: String(r.youtube_id), name: String(r.name), notes: String(r.notes), fetchedAt: (r.fetched_at as string) ?? null, videos: vids.length, median: median(vids.map((v) => v.views)) };
  });
}

export function deleteCompetitor(db: DB, id: string) {
  db.prepare("DELETE FROM yt_comp_videos WHERE competitor_id = ?").run(id);
  db.prepare("DELETE FROM yt_competitors WHERE id = ?").run(id);
}

/** Competitors' videos that did far better than their usual: proven topics to do your own angle on. */
export function breakouts(db: DB, ytChannelId: string, min = 1.8): CompVideo[] {
  const out: CompVideo[] = [];
  for (const c of listCompetitors(db, ytChannelId)) {
    if (!c.median) continue;
    for (const v of db.prepare("SELECT * FROM yt_comp_videos WHERE competitor_id = ? AND views IS NOT NULL").all(c.id) as R[]) {
      const views = Number(v.views);
      if (views / c.median >= min) out.push({ videoId: String(v.video_id), competitor: c.name, title: String(v.title), publishedAt: (v.published_at as string) ?? null, views, seconds: (v.seconds as number) ?? null, multiple: views / c.median, thumbnail: (v.thumbnail as string) ?? null, url: `https://www.youtube.com/watch?v=${v.video_id}` });
    }
  }
  return out.sort((a, b) => b.multiple - a.multiple).slice(0, 30);
}

/** Today's stories (from the Desk) that none of your competitors have covered in the last 30 days. */
export async function missedAngles(db: DB, ytChannelId: string): Promise<{ id: string; headline: string; why: string; sources: number }[]> {
  const yt = getYtChannel(db, ytChannelId);
  if (!yt?.deskChannelId) return [];
  const { setActiveChannel, activeChannelId } = await import("../channels");
  const { storiesToBuild } = await import("../ideation/build-stories");
  const original = activeChannelId(db);
  let stories: { id: string; headline: string; why: string; sourceCount: number }[] = [];
  try {
    setActiveChannel(db, yt.deskChannelId);
    stories = storiesToBuild(db, 20);
  } finally {
    setActiveChannel(db, original);
  }
  const covered = (db.prepare(
    `SELECT v.title FROM yt_comp_videos v JOIN yt_competitors c ON c.id = v.competitor_id WHERE c.yt_channel_id = ? AND v.published_at >= datetime('now', '-30 days')`,
  ).all(ytChannelId) as { title: string }[]).map((r) => new Set(uniqueTokens(r.title)));
  return stories
    .filter((s) => !covered.some((t) => jaccard(t, new Set(uniqueTokens(s.headline))) >= 0.2))
    .slice(0, 10)
    .map((s) => ({ id: s.id, headline: s.headline, why: s.why, sources: s.sourceCount }));
}

// ---------------------------------------------------------------------------
// Packaging: title lab and description builder
// ---------------------------------------------------------------------------

export interface TitleCheck { ok: boolean; text: string }

export function checkTitle(title: string): { checks: TitleCheck[]; score: number } {
  const t = title.trim();
  const words = t.split(/\s+/).filter(Boolean);
  const checks: TitleCheck[] = [
    { ok: t.length > 0 && t.length <= 60, text: `${t.length} characters — ${t.length <= 60 ? "fits on phones" : "over 60 gets cut off on phones"}` },
    { ok: t.length >= 25, text: t.length >= 25 ? "Long enough to make a clear promise" : "Too short to promise anything specific" },
    { ok: /\b(why|how|what|who|the real|secret|nobody|truth|actually|really|behind|hidden|explained)\b|\?/i.test(t), text: "Curiosity: a question or a ‘real story’ promise" },
    { ok: /\d/.test(t) || /\b(bangladesh|dhaka|india|china|taka|bnp|awami|hasina|yunus)\b/i.test(t), text: "Something specific: a number, a place or a name" },
    { ok: !/^[^a-z]*$/.test(t) && (t.match(/\b[A-Z]{3,}\b/g)?.length ?? 0) <= 1, text: "Not shouting (at most one ALL-CAPS word)" },
    { ok: !/\b(shocking|you won't believe|gone wrong|must watch|insane|exposed!!)\b/i.test(t), text: "No cheap clickbait words that hurt trust" },
    { ok: words.length > 0 && words.slice(0, 4).some((w) => w.length > 4), text: "The main subject appears early" },
  ];
  return { checks, score: Math.round((checks.filter((c) => c.ok).length / checks.length) * 100) };
}

/** What people type into YouTube search about a topic (YouTube's own free suggestions). */
export async function searchSuggestions(q: string): Promise<string[]> {
  const out = new Set<string>();
  for (const prefix of ["", "why ", "how ", "what is "]) {
    try {
      const r = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&hl=en&q=${encodeURIComponent(prefix + q)}`, { signal: AbortSignal.timeout(5000) });
      const j = (await r.json()) as [string, string[]];
      for (const s of j[1] ?? []) out.add(s);
    } catch {
      /* best effort */
    }
  }
  return [...out].slice(0, 20);
}

/** A ready-to-paste description: hook, chapters (estimated from the script at your speaking pace), sources, CTA, links. */
export function buildDescription(db: DB, projectId: string, wpm = 150): string | null {
  const p = getProduction(db, projectId);
  if (!p) return null;
  const script = p.docs.script ?? "";
  const lines = script.split("\n");
  const sections: { title: string; words: number }[] = [];
  let cur: { title: string; words: number } | null = null;
  let inRefs = false;
  const spoken: string[] = [];
  for (const raw of lines) {
    const l = raw.trim();
    if (/^##\s+(Sources|Check before recording)/i.test(l)) { inRefs = true; continue; }
    if (/^##\s+/.test(l)) { inRefs = false; cur = { title: l.replace(/^##\s+/, ""), words: 0 }; sections.push(cur); continue; }
    if (inRefs || !l || l.startsWith("#") || l.startsWith("▸")) continue;
    const w = l.replace(/\[\d+\]/g, "").split(/\s+/).length;
    if (cur) cur.words += w;
    spoken.push(l.replace(/\[\d+\]/g, "").trim());
  }
  let t = 0;
  const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const chapters = sections.filter((s) => s.words > 0).map((s) => {
    const line = `${clock(t)} ${s.title}`;
    t += (s.words / wpm) * 60;
    return line;
  });
  if (chapters.length) chapters[0] = chapters[0].replace(/^\S+/, "0:00");
  const refs = script.split(/##\s+Sources/i)[1]?.trim().split("\n").filter((l) => /^\d+\./.test(l.trim())).map((l) => l.trim()) ?? [];
  const yt = p.docs.yt_channel ? getYtChannel(db, p.docs.yt_channel) : null;
  const tags = (p.title.match(/\b[A-Z][a-z]+\b/g) ?? []).slice(0, 3).map((w) => `#${w}`);
  return [
    spoken[0] ?? p.title,
    spoken[1] ?? "",
    "",
    chapters.length ? `⏱ Chapters (check the times against your edit)\n${chapters.join("\n")}` : "",
    "",
    refs.length ? `📚 Sources\n${refs.join("\n")}` : "",
    "",
    "💬 Tell me in the comments: what did I miss?",
    yt?.handle ? `🔔 Subscribe for a new explainer every week: https://www.youtube.com/${yt.handle}` : "",
    "",
    [...tags, "#Bangladesh"].join(" "),
  ].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n").trim();
}

// ---------------------------------------------------------------------------
// Per-project YouTube settings & review
// ---------------------------------------------------------------------------

export interface Review { ctr?: number; avdSeconds?: number; lengthSeconds?: number; views?: number; first30?: number; lesson?: string }

export function setProjectYoutube(db: DB, projectId: string, patch: { ytChannelId?: string; format?: string; review?: Review }) {
  const docs: Record<string, string> = {};
  if (patch.ytChannelId !== undefined) docs.yt_channel = patch.ytChannelId;
  if (patch.format !== undefined) docs.yt_format = patch.format;
  if (patch.review) docs.yt_review = JSON.stringify(patch.review);
  return updateProduction(db, projectId, { docs });
}

export function diagnose(r: Review): { metric: string; status: "good" | "watch" | "fix"; advice: string }[] {
  const out: { metric: string; status: "good" | "watch" | "fix"; advice: string }[] = [];
  if (r.ctr != null) out.push(r.ctr < 3 ? { metric: "Click-through rate", status: "fix", advice: "Below 3%: change the thumbnail first (bigger face/emotion, fewer words), then sharpen the title's promise." } : r.ctr < 5 ? { metric: "Click-through rate", status: "watch", advice: "OK. Test a second thumbnail with Test & compare to push it higher." } : { metric: "Click-through rate", status: "good", advice: "Strong packaging — reuse this thumbnail style." });
  if (r.avdSeconds != null && r.lengthSeconds) {
    const pct = r.avdSeconds / r.lengthSeconds;
    out.push(pct < 0.3 ? { metric: "Average view duration", status: "fix", advice: `${Math.round(pct * 100)}% watched: tighten pacing — a visual change every 5–10s, cut tangents, add open loops.` } : pct < 0.45 ? { metric: "Average view duration", status: "watch", advice: `${Math.round(pct * 100)}% watched — decent; find the biggest drop in the retention graph and fix that kind of moment next time.` } : { metric: "Average view duration", status: "good", advice: `${Math.round(pct * 100)}% watched — excellent for explainers.` });
  }
  if (r.first30 != null) out.push(r.first30 < 65 ? { metric: "Still watching at 0:30", status: "fix", advice: "Hook problem: open with the most surprising fact or the question; cut greetings; make line one match the title and thumbnail." } : { metric: "Still watching at 0:30", status: "good", advice: "Hook works." });
  return out;
}
