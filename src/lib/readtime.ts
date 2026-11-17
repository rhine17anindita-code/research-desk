/**
 * Read time: how long a script takes to say out loud at the creator's own pace, plus any clips,
 * sound bites or B-roll that play without them talking. Pure functions (used in the browser too).
 */

export const DEFAULT_WPM = 150;
export const SHORTS_MAX = 180; // Shorts/Reels/TikTok: keep it under 3:00

export interface Extra { label: string; seconds: number; auto?: boolean }
export interface Target { min: number; max: number; label: string; hard?: boolean }
export interface ReadTime { words: number; speechSec: number; extrasSec: number; pausesSec: number; totalSec: number; extras: Extra[] }

/** Only the words said on camera: no headings, on-screen notes (▸), source labels, [CHECK]s or the sources list. */
export function spokenText(script: string): string {
  const out: string[] = [];
  let stop = false;
  for (const raw of script.split("\n")) {
    const l = raw.trim();
    if (/^#{1,3}\s+(Sources|Check before recording|Verify)/i.test(l)) { stop = true; continue; }
    if (/^#{1,3}\s+/.test(l)) { stop = false; continue; }
    if (stop || !l || l.startsWith("▸") || l.startsWith(">") || /^(\[.*\]|\(.*\))$/.test(l)) continue;
    out.push(l.replace(/\[(S?\d+(,\s*S?\d+)*)\]/gi, "").replace(/\[CHECK:[^\]]*\]/gi, "").replace(/[*_`]/g, ""));
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
}

export function countWords(text: string): number {
  return text ? text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length : 0;
}

/** "0:45", "1:05", "20s", "20 sec", "2 min", "1m30s" → seconds. */
export function parseDuration(s: string): number | null {
  const t = s.trim().toLowerCase();
  let m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = t.match(/^(?:(\d+)\s*m(?:in(?:s|utes?)?)?)?\s*(?:(\d+)\s*s(?:ec(?:s|onds?)?)?)?$/);
  if (m && (m[1] || m[2])) return Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
  if (/^\d+$/.test(t)) return Number(t);
  return null;
}

/** On-screen notes that say how long a clip runs, e.g. "▸ Clip: PM's speech (0:20)" or "▸ B-roll 15s". */
export function extrasFromScript(script: string): Extra[] {
  const out: Extra[] = [];
  for (const raw of script.split("\n")) {
    const l = raw.trim();
    if (!l.startsWith("▸")) continue;
    const m = l.match(/(\d{1,2}:\d{2}|\d+\s*(?:s|sec|secs|seconds)\b|\d+\s*m(?:in)?s?\s*\d*\s*s?\b)/i);
    if (!m || !/(clip|bite|sound|audio|b-?roll|footage|video|music|interview|soundbite|archive|play)/i.test(l)) continue;
    const sec = parseDuration(m[1].replace(/\s+/g, ""));
    if (sec && sec <= 900) out.push({ label: l.replace(/^▸\s*/, "").slice(0, 80), seconds: sec, auto: true });
  }
  return out;
}

/** Total time on screen: speech at the creator's pace + a short beat between sections + clips/extras. */
export function readTime(script: string, wpm: number, extras: Extra[] = []): ReadTime {
  const words = countWords(spokenText(script));
  const sections = Math.max(0, (script.match(/^##\s+/gm)?.length ?? 1) - 1);
  const pace = wpm > 40 && wpm < 400 ? wpm : DEFAULT_WPM;
  const speechSec = Math.round((words / pace) * 60);
  const pausesSec = Math.round(sections * 0.7);
  const all = [...extrasFromScript(script), ...extras];
  const extrasSec = all.reduce((t, e) => t + (e.seconds || 0), 0);
  return { words, speechSec, extrasSec, pausesSec, totalSec: speechSec + pausesSec + extrasSec, extras: all };
}

/** What length this piece should land at. */
export function targetFor(contentType: string, formatLength?: string | null): Target | null {
  if (contentType === "short") return { min: 30, max: SHORTS_MAX, label: "Short: under 3:00", hard: true };
  if (formatLength) {
    const m = formatLength.match(/(\d+)\s*[–-]\s*(\d+)\s*(s|min)/);
    if (m) {
      const k = m[3] === "s" ? 1 : 60;
      return { min: Number(m[1]) * k, max: Number(m[2]) * k, label: `Format: ${formatLength}`, hard: m[3] === "s" };
    }
  }
  if (contentType === "podcast" || contentType === "interview") return null;
  if (contentType === "video" || contentType === "series" || contentType === "sponsored") return { min: 480, max: 900, label: "YouTube sweet spot: 8–15 min" };
  return null;
}

export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

/** How many words to cut (negative) or how much room is left (positive) to hit the target. */
export function wordsToTarget(rt: ReadTime, wpm: number, t: Target): { cut: number; room: number; short: number } {
  const pace = wpm > 40 && wpm < 400 ? wpm : DEFAULT_WPM;
  const toWords = (sec: number) => Math.round((sec / 60) * pace);
  const over = rt.totalSec - t.max;
  return { cut: over > 0 ? toWords(over) : 0, room: over < 0 ? toWords(-over) : 0, short: rt.totalSec < t.min ? toWords(t.min - rt.totalSec) : 0 };
}

/** A passage to read aloud when measuring your pace (about 150 words, plain news English). */
export const PACE_PASSAGE = `Every year, millions of Bangladeshis send money home from the Gulf, Malaysia and Europe. Those remittances are one of the biggest reasons the country's shelves stay stocked and its currency doesn't collapse. But a large share of that money never touches a bank. It travels through hundi, an informal network of agents who move cash across borders on trust, often faster and cheaper than the official route. Why would anyone choose the official route at all? Banks offer a small incentive, but the black market rate is usually better. So every time the gap between the two rates grows, more money slips out of sight. The government loses dollars it badly needs, and families lose the protection of a formal record. Fixing it isn't just about policing agents. It's about making the legal way the easy way, and that's a much harder problem.`;
