import type { DB } from "./db";
import { getSecret } from "./secrets";
import { getSetting, setSetting } from "./repo/settings";
import { nowIso } from "./ids";
import { truncate } from "./text";
import { saveTranslation, translationJobs, isBangla } from "./translate";
import { storeTranscript, type Segment } from "./transcripts";
import { setVoiceSourceText } from "./voice";

/**
 * Everything the Mac helper used to do, done by the server itself so nothing depends on a laptop:
 *  - transcripts and video-to-text through Supadata (an API; free plan 100 a month) when YouTube blocks this server;
 *  - Bangla headlines → English through MyMemory's free public translation API (short text only).
 * Runs on the feed schedule. The Mac helper still works as an optional extra.
 */

// ---------------------------------------------------------------------------
// Supadata (transcripts from YouTube, TikTok, Instagram, Facebook, X or a media file)
// ---------------------------------------------------------------------------

const month = () => new Date().toISOString().slice(0, 7);
interface Usage { month: string; n: number }

export function supadataUsage(db: DB): Usage & { cap: number } {
  let u: Usage = { month: month(), n: 0 };
  try {
    const raw = (db.prepare("SELECT value FROM secrets WHERE key = 'supadata.usage'").get() as { value: string } | undefined)?.value;
    if (raw) u = JSON.parse(raw) as Usage;
  } catch { /* none yet */ }
  if (u.month !== month()) u = { month: month(), n: 0 };
  return { ...u, cap: getSetting(db, "transcripts.monthly_cap") };
}
function countUse(db: DB, credits: number) {
  const u = supadataUsage(db);
  db.prepare("INSERT INTO secrets (key, value, updated_at) VALUES ('supadata.usage', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .run(JSON.stringify({ month: u.month, n: u.n + credits }), nowIso());
}

export function transcriptServiceReady(db: DB): boolean {
  const u = supadataUsage(db);
  return !!getSecret(db, "SUPADATA_API_KEY") && u.n < u.cap;
}

type SupaContent = { text: string; offset?: number; duration?: number }[] | string;

/**
 * A transcript through Supadata. mode "native" = existing captions only (1 credit, safe for long
 * talk shows); "auto" also transcribes the audio when there are none (for short clips and Reels).
 */
export async function supadataTranscript(db: DB, url: string, opts: { lang?: string; mode?: "native" | "auto" } = {}): Promise<{ language: string | null; segments: Segment[] } | null> {
  const key = getSecret(db, "SUPADATA_API_KEY");
  if (!key) throw new Error("No transcript service connected");
  if (!transcriptServiceReady(db)) throw new Error("This month's transcript allowance is used up");
  const q = new URLSearchParams({ url, mode: opts.mode ?? "native" });
  if (opts.lang) q.set("lang", opts.lang);
  const headers = { "x-api-key": key };
  let r = await fetch(`https://api.supadata.ai/v1/transcript?${q}`, { headers, signal: AbortSignal.timeout(60000) });
  countUse(db, 1);
  let j = (await r.json().catch(() => ({}))) as { jobId?: string; status?: string; lang?: string; content?: SupaContent; message?: string; error?: string };
  // Long or AI-transcribed videos come back as a job to poll.
  if (r.status === 202 && j.jobId) {
    for (let i = 0; i < 30; i++) {
      await new Promise((res) => setTimeout(res, 4000));
      r = await fetch(`https://api.supadata.ai/v1/transcript/${encodeURIComponent(j.jobId)}`, { headers, signal: AbortSignal.timeout(30000) });
      const k = (await r.json().catch(() => ({}))) as typeof j & { result?: typeof j };
      if (k.status === "completed") { j = k.result ?? k; break; }
      if (k.status === "failed") throw new Error(k.error || "The transcript service couldn't transcribe this video");
    }
  }
  if (r.status === 404 || r.status === 206) return null;
  if (!r.ok && r.status !== 202) throw new Error(j.message || j.error || `Transcript service answered ${r.status}`);
  const c = j.content;
  if (!c) return null;
  const segments: Segment[] = typeof c === "string"
    ? [{ t: 0, d: 0, text: c }]
    : c.map((x) => ({ t: (x.offset ?? 0) / 1000, d: (x.duration ?? 0) / 1000, text: x.text.replace(/\s+/g, " ").trim() })).filter((x) => x.text);
  return segments.length ? { language: j.lang ?? null, segments } : null;
}

/** Transcripts waiting (from talk shows you opened, or links you saved) — newest first. */
async function queuedTranscripts(db: DB, limit: number) {
  const rows = db.prepare("SELECT video_id, article_id FROM transcripts WHERE status = 'queued' ORDER BY fetched_at DESC LIMIT ?").all(limit) as { video_id: string; article_id: string | null }[];
  let done = 0;
  for (const r of rows) {
    if (!transcriptServiceReady(db)) break;
    try {
      const lang = r.article_id ? ((db.prepare("SELECT COALESCE(a.language, f.language, 'en') AS l FROM articles a LEFT JOIN feeds f ON f.id = a.feed_id WHERE a.id = ?").get(r.article_id) as { l: string } | undefined)?.l ?? "en").slice(0, 2) : undefined;
      const t = await supadataTranscript(db, `https://www.youtube.com/watch?v=${r.video_id}`, { lang, mode: "native" });
      storeTranscript(db, r.video_id, r.article_id, t ? { status: "ok", language: t.language, kind: "asr", segments: t.segments } : { status: "none" });
      // Saved research links wait for their transcript: fill them in.
      if (t) {
        const text = t.segments.map((s) => s.text).join(" ");
        db.prepare("UPDATE research_items SET body = ?, status = 'ready', error = NULL, updated_at = ? WHERE url LIKE ? AND (body IS NULL OR length(body) < 400)").run(truncate(text, 60000), nowIso(), `%${r.video_id}%`);
      }
      done++;
    } catch (e) {
      storeTranscript(db, r.video_id, r.article_id, { status: "error", error: (e as Error).message.slice(0, 300) });
    }
  }
  return done;
}

/** Video links in Voice Lab and My research (Reels, TikToks, Facebook videos, YouTube): words from the audio. */
async function mediaJobs(db: DB, limit: number) {
  const jobs = [
    ...(db.prepare("SELECT id, url FROM voice_sources WHERE status = 'queued' AND url IS NOT NULL ORDER BY created_at LIMIT ?").all(limit) as { id: string; url: string }[]).map((r) => ({ type: "voice" as const, ...r })),
    ...(db.prepare("SELECT id, url FROM research_items WHERE media_status = 'queued' AND url IS NOT NULL ORDER BY created_at LIMIT ?").all(limit) as { id: string; url: string }[]).map((r) => ({ type: "research" as const, ...r })),
  ].slice(0, limit);
  let done = 0;
  for (const j of jobs) {
    if (!transcriptServiceReady(db)) break;
    let text = "";
    let error = "";
    try {
      const t = await supadataTranscript(db, j.url, { mode: "auto" });
      text = t ? t.segments.map((s) => s.text).join(" ").trim().slice(0, 60000) : "";
      if (!text) error = "No speech found in this video";
    } catch (e) {
      error = (e as Error).message.slice(0, 300);
    }
    if (j.type === "voice") setVoiceSourceText(db, j.id, text ? { status: "ready", text } : { status: "failed", error });
    else if (text) db.prepare("UPDATE research_items SET body = ?, status = 'ready', error = NULL, media_status = 'done', updated_at = ? WHERE id = ?").run(text, nowIso(), j.id);
    else db.prepare("UPDATE research_items SET media_status = 'failed', error = ?, updated_at = ? WHERE id = ?").run(error, nowIso(), j.id);
    done++;
  }
  return done;
}

// ---------------------------------------------------------------------------
// Free translation of short Bangla text (headlines) — MyMemory's public API
// ---------------------------------------------------------------------------

const DAILY_CHARS = 4500; // stay under the anonymous daily allowance

async function myMemory(text: string): Promise<string | null> {
  const r = await fetch(`https://api.mymemory.translated.net/get?langpair=bn|en&q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) return null;
  const j = (await r.json()) as { responseStatus?: number | string; responseData?: { translatedText?: string }; quotaFinished?: boolean };
  if (j.quotaFinished || Number(j.responseStatus) !== 200) return null;
  const out = j.responseData?.translatedText?.trim();
  return out && !/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(out) ? out : null;
}

async function translateHeadlinesFree(db: DB, limit: number) {
  const today = new Date().toISOString().slice(0, 10);
  const usedRaw = getSetting(db, "translate.free_used");
  let used = usedRaw?.startsWith(today) ? Number(usedRaw.split(":")[1]) || 0 : 0;
  let done = 0;
  for (const job of translationJobs(db).filter((j) => j.kind === "article").slice(0, limit)) {
    const title = job.parts[0];
    // MyMemory takes up to 500 bytes per request; Bangla is ~3 bytes a character.
    if (!isBangla(title) || Buffer.byteLength(title) > 480) continue;
    if (used + title.length > DAILY_CHARS) break;
    const en = await myMemory(title).catch(() => null);
    used += title.length;
    if (!en) break; // quota or outage: try again next run
    saveTranslation(db, "article", job.id, [en], "mymemory");
    done++;
  }
  setSetting(db, "translate.free_used", `${today}:${used}`);
  return done;
}

let running = false;
export async function runCloudJobs(db: DB): Promise<{ transcripts: number; media: number; translated: number } | null> {
  if (running) return null;
  running = true;
  try {
    const transcripts = transcriptServiceReady(db) ? await queuedTranscripts(db, 8) : 0;
    const media = transcriptServiceReady(db) ? await mediaJobs(db, 3) : 0;
    const translated = await translateHeadlinesFree(db, 30).catch(() => 0);
    return { transcripts, media, translated };
  } finally {
    running = false;
  }
}
