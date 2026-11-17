import type { DB } from "./db";
import { parseJson } from "./db";
import { nowIso } from "./ids";
import { windows, type Segment } from "./transcripts";
import { truncate } from "./text";

/**
 * Bangla → English, free: your Mac's helper translates with an offline model (Meta's NLLB),
 * so no AI credits are used. Translations are machine translations — faithful, not perfect;
 * names and idioms can come out oddly.
 */

export type TKind = "transcript" | "article" | "research" | "voice";

/** Mostly Bangla script? (Ignores numbers, punctuation and the odd English word.) */
export function isBangla(text: string | null | undefined, share = 0.4): boolean {
  if (!text) return false;
  const bn = text.match(/[ঀ-৿]/g)?.length ?? 0;
  const latin = text.match(/[A-Za-z]/g)?.length ?? 0;
  return bn >= 8 && bn / Math.max(1, bn + latin) >= share;
}

/** Split long text into translatable pieces (paragraphs, then sentences). */
export function splitParts(text: string, max = 400): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n+/).map((p) => p.trim()).filter(Boolean)) {
    if (para.length <= max) { out.push(para); continue; }
    let cur = "";
    for (const sent of para.split(/(?<=[।?!.])\s+/)) {
      if ((cur + " " + sent).length > max && cur) { out.push(cur.trim()); cur = ""; }
      cur += " " + sent;
    }
    if (cur.trim()) out.push(cur.trim());
  }
  return out;
}

export function getTranslation(db: DB, kind: TKind, id: string): string[] | null {
  const r = db.prepare("SELECT parts FROM translations WHERE kind = ? AND ref_id = ?").get(kind, id) as { parts: string } | undefined;
  return r ? parseJson<string[]>(r.parts, []) : null;
}

export function saveTranslation(db: DB, kind: TKind, id: string, parts: string[], model: string) {
  db.prepare(
    `INSERT INTO translations (kind, ref_id, parts, model, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(kind, ref_id) DO UPDATE SET parts = excluded.parts, model = excluded.model, created_at = excluded.created_at`,
  ).run(kind, id, JSON.stringify(parts.map((p) => String(p).slice(0, 4000))), model, nowIso());
}

/** The pieces of a thing to translate, in the order the page shows them. */
export function partsOf(db: DB, kind: TKind, id: string): string[] | null {
  if (kind === "transcript") {
    const r = db.prepare("SELECT segments FROM transcripts WHERE video_id = ? AND status = 'ok'").get(id) as { segments: string } | undefined;
    return r ? windows(parseJson<Segment[]>(r.segments, [])).map((w) => w.text) : null;
  }
  if (kind === "article") {
    const r = db.prepare("SELECT title, summary FROM articles WHERE id = ?").get(id) as { title: string; summary: string | null } | undefined;
    return r ? [r.title, ...(r.summary ? [truncate(r.summary, 700)] : [])] : null;
  }
  if (kind === "research") {
    const r = db.prepare("SELECT body FROM research_items WHERE id = ?").get(id) as { body: string | null } | undefined;
    return r?.body ? splitParts(r.body).slice(0, 120) : null;
  }
  const r = db.prepare("SELECT text FROM voice_sources WHERE id = ?").get(id) as { text: string | null } | undefined;
  return r?.text ? splitParts(r.text).slice(0, 120) : null;
}

/** Bangla things without a translation yet: what the Mac helper should translate next. */
export function translationJobs(db: DB): { kind: TKind; id: string; parts: string[] }[] {
  const jobs: { kind: TKind; id: string; parts: string[] }[] = [];
  const done = (kind: TKind, id: string) => !!db.prepare("SELECT 1 FROM translations WHERE kind = ? AND ref_id = ?").get(kind, id);
  const add = (kind: TKind, id: string) => {
    if (done(kind, id)) return;
    const parts = partsOf(db, kind, id);
    if (parts?.length) jobs.push({ kind, id, parts });
  };
  // Bangla episode and news titles/summaries (short, many).
  for (const r of db.prepare(
    `SELECT a.id, a.title FROM articles a JOIN feeds f ON f.id = a.feed_id
     WHERE COALESCE(a.published_at, a.fetched_at) >= strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-7 days') AND (f.language = 'bn' OR a.language = 'bn')
     ORDER BY COALESCE(a.published_at, a.fetched_at) DESC LIMIT 400`,
  ).all() as { id: string; title: string }[]) {
    if (isBangla(r.title)) add("article", r.id);
    if (jobs.length >= 40) break;
  }
  // Whole transcripts of Bangla shows (long: a few per run).
  for (const r of db.prepare("SELECT video_id FROM transcripts WHERE status = 'ok' AND language LIKE 'bn%' ORDER BY fetched_at DESC LIMIT 30").all() as { video_id: string }[]) {
    if (jobs.filter((j) => j.kind === "transcript").length >= 3) break;
    add("transcript", r.video_id);
  }
  for (const r of db.prepare("SELECT id, body FROM research_items WHERE body IS NOT NULL ORDER BY created_at DESC LIMIT 50").all() as { id: string; body: string }[]) if (isBangla(r.body)) add("research", r.id);
  for (const r of db.prepare("SELECT id, text FROM voice_sources WHERE status = 'ready' ORDER BY created_at DESC LIMIT 50").all() as { id: string; text: string | null }[]) if (isBangla(r.text)) add("voice", r.id);
  return jobs.slice(0, 50);
}
