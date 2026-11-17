import type { DB } from "./db";
import { parseJson } from "./db";
import { nowIso } from "./ids";
import { youtubeId } from "./media";
import { getArticle } from "./repo/stories";
import { activeChannel, termMatcher } from "./channels";
import { BD } from "./ideation/talk";
import { getSetting, setSetting } from "./repo/settings";

/**
 * Transcripts of talk shows and podcasts, from YouTube's own captions (free, no key).
 * Most are automatic captions: good enough to find moments, not to quote word-for-word
 * (Bangla especially) — always check against the video before using a line.
 */

export interface Segment { t: number; d: number; text: string }
export interface Transcript {
  videoId: string;
  articleId: string | null;
  language: string | null;
  kind: string | null;
  segments: Segment[];
  chars: number;
  /** queued = waiting for the Mac helper (YouTube blocks this server). */
  status: "ok" | "none" | "error" | "queued";
  error: string | null;
  mined: unknown;
  minedAt: string | null;
  fetchedAt: string;
}

interface Row { video_id: string; article_id: string | null; language: string | null; kind: string | null; segments: string; chars: number; status: string; error: string | null; mined: string | null; mined_at: string | null; fetched_at: string }
const map = (r: Row): Transcript => ({
  videoId: r.video_id, articleId: r.article_id, language: r.language, kind: r.kind, segments: parseJson<Segment[]>(r.segments, []), chars: r.chars,
  status: r.status as Transcript["status"], error: r.error, mined: r.mined ? parseJson(r.mined, null) : null, minedAt: r.mined_at, fetchedAt: r.fetched_at,
});

export const clock = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};
export const parseClock = (c: string): number | null => {
  const p = c.trim().split(":").map(Number);
  if (!p.length || p.some((n) => Number.isNaN(n))) return null;
  return p.reduce((a, n) => a * 60 + n, 0);
};
export const watchUrl = (videoId: string, sec = 0) => `https://www.youtube.com/watch?v=${videoId}${sec > 0 ? `&t=${Math.floor(sec)}s` : ""}`;

interface Track { baseUrl: string; languageCode: string; kind?: string }

/** Download captions for one video. Prefers the show's language, and human captions over automatic ones. */
export async function downloadTranscript(videoId: string, preferLang = "en"): Promise<{ language: string; kind: string; segments: Segment[] } | null> {
  const r = await fetch("https://www.youtube.com/youtubei/v1/player", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ videoId, context: { client: { clientName: "ANDROID", clientVersion: "20.10.38", hl: "en" } } }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`YouTube answered ${r.status}`);
  const j = (await r.json()) as { captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: Track[] } }; playabilityStatus?: { status?: string; reason?: string } };
  const tracks = j.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  if (!tracks.length) {
    if (j.playabilityStatus?.status && j.playabilityStatus.status !== "OK") throw new Error(j.playabilityStatus.reason || `Video not available (${j.playabilityStatus.status})`);
    return null;
  }
  const order = [preferLang, preferLang === "bn" ? "en" : "bn", "en", "hi", "ur"];
  const score = (t: Track) => (order.indexOf(t.languageCode.slice(0, 2)) + 1 || 9) * 2 + (t.kind === "asr" ? 1 : 0);
  const pick = [...tracks].sort((a, b) => score(a) - score(b))[0];
  const x = await fetch(pick.baseUrl.replace(/&fmt=[^&]+/, "") + "&fmt=json3", { signal: AbortSignal.timeout(20000) });
  if (!x.ok) throw new Error(`Captions answered ${x.status}`);
  const data = (await x.json()) as { events?: { tStartMs?: number; dDurationMs?: number; segs?: { utf8?: string }[] }[] };
  const segments: Segment[] = [];
  for (const e of data.events ?? []) {
    const text = (e.segs ?? []).map((s) => s.utf8 ?? "").join("").replace(/\s+/g, " ").trim();
    if (!text) continue;
    segments.push({ t: (e.tStartMs ?? 0) / 1000, d: (e.dDurationMs ?? 0) / 1000, text });
  }
  return { language: pick.languageCode, kind: pick.kind === "asr" ? "asr" : "manual", segments };
}

export function cachedTranscript(db: DB, videoId: string): Transcript | null {
  const r = db.prepare("SELECT * FROM transcripts WHERE video_id = ?").get(videoId) as Row | undefined;
  return r ? map(r) : null;
}

/** Transcript for a talk-show episode (article id), fetched once and cached. Misses are retried after 6 hours. */
export const BOT_BLOCK = /not a bot|sign in to confirm|LOGIN_REQUIRED|unusual traffic/i;
const blockedRecently = (db: DB) => {
  const t = getSetting(db, "transcripts.blocked_at");
  return !!t && Date.now() - Date.parse(t) < 24 * 3_600_000;
};

export function storeTranscript(
  db: DB,
  vid: string,
  articleId: string | null,
  r: { status: Transcript["status"]; language?: string | null; kind?: string | null; segments?: Segment[]; error?: string | null },
) {
  const segs = r.segments ?? [];
  db.prepare(
    `INSERT INTO transcripts (video_id, article_id, language, kind, segments, chars, status, error, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(video_id) DO UPDATE SET article_id = COALESCE(excluded.article_id, article_id), language = excluded.language, kind = excluded.kind, segments = excluded.segments,
       chars = excluded.chars, status = excluded.status, error = excluded.error, fetched_at = excluded.fetched_at`,
  ).run(vid, articleId, r.language ?? null, r.kind ?? null, JSON.stringify(segs), segs.reduce((n, x) => n + x.text.length, 0), r.status, r.error ?? null, nowIso());
}

/** Ask for a transcript the server can't fetch itself: the Mac helper picks it up. */
export function queueTranscript(db: DB, vid: string, articleId: string | null) {
  const cur = cachedTranscript(db, vid);
  if (cur && (cur.status === "ok" || cur.status === "queued")) return;
  storeTranscript(db, vid, articleId, { status: "queued", error: null });
}

/**
 * Transcript for a talk-show episode (article id), fetched once and cached. Misses are retried
 * after 6 hours. When YouTube blocks this server (it does for most hosting companies), the job is
 * queued for the Mac helper instead of showing YouTube's "not a bot" message.
 */
export async function transcriptFor(db: DB, articleId: string): Promise<Transcript | null> {
  const a = getArticle(db, articleId);
  const vid = a ? youtubeId(a.url) : null;
  if (!a || !vid) return null;
  const cached = cachedTranscript(db, vid);
  if (cached && (cached.status === "ok" || cached.status === "queued" || Date.now() - Date.parse(cached.fetchedAt) < 6 * 3_600_000)) return cached;
  if (blockedRecently(db)) {
    queueTranscript(db, vid, articleId);
    return cachedTranscript(db, vid);
  }
  try {
    const lang = (db.prepare("SELECT COALESCE(a.language, f.language, 'en') AS l FROM articles a LEFT JOIN feeds f ON f.id = a.feed_id WHERE a.id = ?").get(articleId) as { l: string } | undefined)?.l ?? "en";
    const got = await downloadTranscript(vid, lang.slice(0, 2));
    storeTranscript(db, vid, articleId, got?.segments.length ? { status: "ok", ...got } : { status: "none" });
  } catch (e) {
    const msg = (e as Error).message;
    if (BOT_BLOCK.test(msg)) {
      setSetting(db, "transcripts.blocked_at", nowIso());
      storeTranscript(db, vid, articleId, { status: "queued" });
    } else storeTranscript(db, vid, articleId, { status: "error", error: msg.slice(0, 300) });
  }
  return cachedTranscript(db, vid);
}

export function saveMined(db: DB, videoId: string, mined: unknown) {
  db.prepare("UPDATE transcripts SET mined = ?, mined_at = ? WHERE video_id = ?").run(JSON.stringify(mined), nowIso(), videoId);
}

// ---------------------------------------------------------------------------
// Free moment finder: splits the conversation into ~75-second windows and scores
// each for this channel's focus, Bangladesh, numbers, and "here's what's really
// going on" language. No AI — candidates to look at, not verified claims.
// ---------------------------------------------------------------------------

export interface Window { start: number; end: number; text: string }
export interface Moment extends Window { score: number; reasons: string[]; url: string }

export function windows(segments: Segment[], seconds = 75): Window[] {
  const out: Window[] = [];
  let cur: Segment[] = [];
  for (const s of segments) {
    cur.push(s);
    if (s.t + s.d - cur[0].t >= seconds) {
      out.push({ start: cur[0].t, end: s.t + s.d, text: cur.map((x) => x.text).join(" ") });
      cur = [];
    }
  }
  if (cur.length) out.push({ start: cur[0].t, end: cur[cur.length - 1].t + cur[cur.length - 1].d, text: cur.map((x) => x.text).join(" ") });
  return out;
}

const NUMBER = /\d[\d,.]*\s?(%|percent|per cent|crore|lakh|billion|million|thousand|taka|tk|dollars?|\$|years?|কোটি|লাখ|হাজার|টাকা|শতাংশ|বছর)|[০-৯]+/gi;
const CUES = [
  "the truth is", "nobody is talking", "no one is talking", "nobody talks", "behind the scenes", "behind closed doors", "what they don't", "what people don't know",
  "i can tell you", "i know for a fact", "exclusive", "leaked", "secret", "the deal", "corruption", "conspiracy", "exposed", "never been reported", "actually happened",
  "the real reason", "the real story", "inside", "cover-up", "cover up", "documents show", "evidence", "billion", "intelligence", "military", "election", "rigged",
  "আসলে", "গোপন", "দুর্নীতি", "ষড়যন্ত্র", "চুক্তি", "ফাঁস", "সত্য", "ভেতরে", "কেউ জানে না", "প্রমাণ", "নির্বাচন", "সেনা", "গোয়েন্দা", "টাকা পাচার", "ভারত", "আমেরিকা", "চীন",
];
const SPONSOR = /\b(sponsor(ed)? by|brought to you by|use code|promo code|link in the description|subscribe to|patreon|sign up at)\b/i;

export function scoreWindow(text: string, boost: (t: string) => string[], mute: (t: string) => string[]): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const lower = text.toLowerCase();
  const b = boost(text);
  if (b.length) { score += Math.min(6, b.length * 2); reasons.push(`Your focus: ${b.slice(0, 3).join(", ")}`); }
  const bd = text.match(new RegExp(BD.source, "gi"))?.length ?? 0;
  if (bd) { score += Math.min(3, bd * 1.2); reasons.push("Bangladesh"); }
  const nums = text.match(NUMBER)?.length ?? 0;
  if (nums) { score += Math.min(3, nums); if (nums >= 2) reasons.push("Numbers"); }
  const cues = CUES.filter((c) => lower.includes(c));
  if (cues.length) { score += Math.min(4, cues.length * 1.2); reasons.push(`“${cues[0]}”`); }
  const names = new Set(text.match(/\b[A-Z][a-z]+(?: [A-Z][a-z]+)+\b/g) ?? []).size;
  score += Math.min(1.5, names * 0.3);
  if (mute(text).length) score -= 3;
  if (SPONSOR.test(text)) score -= 5;
  return { score, reasons };
}

export function findMoments(db: DB, t: Transcript, limit = 6): Moment[] {
  const ch = activeChannel(db);
  const boost = termMatcher(ch.boostTerms);
  const mute = termMatcher(ch.muteTerms);
  const ws = windows(t.segments);
  const scored = ws.map((w, i) => ({ ...w, i, ...scoreWindow(w.text, boost, mute) }));
  const picked: typeof scored = [];
  for (const w of [...scored].sort((a, b) => b.score - a.score)) {
    if (w.score < 2) break;
    if (picked.some((p) => Math.abs(p.i - w.i) < 2)) continue;
    picked.push(w);
    if (picked.length >= limit) break;
  }
  return picked
    .sort((a, b) => a.start - b.start)
    .map((w) => ({ start: w.start, end: w.end, text: w.text, score: Math.round(w.score * 10) / 10, reasons: w.reasons, url: watchUrl(t.videoId, w.start) }));
}

/** The transcript as text with a [m:ss] mark per window — for the AI, capped by picking the strongest windows. */
export function transcriptText(db: DB, t: Transcript, maxChars = 60000): { text: string; partial: boolean } {
  const ws = windows(t.segments);
  const full = ws.map((w) => `[${clock(w.start)}] ${w.text}`);
  if (full.join("\n").length <= maxChars) return { text: full.join("\n"), partial: false };
  const ch = activeChannel(db);
  const boost = termMatcher(ch.boostTerms);
  const mute = termMatcher(ch.muteTerms);
  const ranked = ws.map((w, i) => ({ i, s: scoreWindow(w.text, boost, mute).score })).sort((a, b) => b.s - a.s);
  const keep = new Set<number>([0, 1]);
  let used = full[0].length + (full[1]?.length ?? 0);
  for (const r of ranked) {
    if (used + full[r.i].length > maxChars) continue;
    keep.add(r.i);
    used += full[r.i].length;
  }
  const lines: string[] = [];
  let prev = -1;
  for (const i of [...keep].sort((a, b) => a - b)) {
    if (prev >= 0 && i !== prev + 1) lines.push("[…]");
    lines.push(full[i]);
    prev = i;
  }
  return { text: lines.join("\n"), partial: true };
}

/** Text around a moment (± one window), for building ideas from a specific part of a show. */
export function textAround(t: Transcript, start: number, span = 1): string {
  const ws = windows(t.segments);
  const i = Math.max(0, ws.findIndex((w) => w.end > start));
  return ws.slice(Math.max(0, i - span), i + span + 1).map((w) => `[${clock(w.start)}] ${w.text}`).join("\n");
}
