import type { DB } from "../db";
import { upsertDaily, upsertPost, type PerfPlatform } from "./store";

/**
 * Imports the stats exports that Meta Business Suite (Instagram, Facebook) and TikTok Studio
 * give you. Column names differ by platform, language setting and year, so columns are matched
 * by meaning rather than exact name; anything unrecognised is reported back, never guessed.
 */

export function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, "");
  const delim = (t.split("\n")[0].match(/;/g)?.length ?? 0) > (t.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : t.split("\n")[0].includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"' && t[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

type Field = "postId" | "url" | "title" | "caption" | "kind" | "published" | "date" | "duration" | "views" | "reach" | "likes" | "comments" | "shares" | "saves" | "follows" | "followers" | "profileViews" | "account" | "pageName";

// Order matters: the first pattern that matches a header claims it.
const FIELDS: [Field, RegExp][] = [
  ["postId", /^(post|video|media|content) ?id$/i],
  ["url", /permalink|^(video |post )?link$|^url$/i],
  ["title", /^(title|video title)$/i],
  ["caption", /^(description|caption|post text|message|text)$/i],
  ["kind", /^(post|media|content) ?type$/i],
  ["published", /publish(ed)? ?(time|date)|^post(ed)? ?(time|date)|^created( time)?$|^date posted$/i],
  ["date", /^date$/i],
  ["duration", /duration/i],
  ["views", /^(total )?(views|video views|plays)$/i],
  ["reach", /^reach$|accounts reached/i],
  ["likes", /^(total )?(likes|reactions)$/i],
  ["comments", /^(total )?comments$/i],
  ["shares", /^(total )?shares$/i],
  ["saves", /^(total )?(saves|favorites|favourites)$/i],
  ["follows", /^follows$|new followers|^followers gained$/i],
  ["followers", /^(total )?followers$/i],
  ["profileViews", /profile (views|visits)/i],
  ["views", /^impressions$/i], // older exports: impressions when there's no views column
  ["account", /account username|^username$/i],
  ["pageName", /page name|account name/i],
];

const num = (s: string | undefined): number | null => {
  if (s == null) return null;
  const t = s.replace(/[,\s]/g, "").trim();
  if (!t || t === "-" || /^n\/?a$/i.test(t)) return null;
  const m = t.match(/^(-?[\d.]+)([kKmM])?$/);
  if (!m) return null;
  const n = Number(m[1]) * (m[2] ? (/k/i.test(m[2]) ? 1e3 : 1e6) : 1);
  return Number.isFinite(n) ? Math.round(n) : null;
};

/** "11/15/2026 18:30", "2026-11-15T18:30:00+0600", "15 Nov 2026" → ISO. Returns null if unsure. */
export function parseDate(s: string | undefined): string | null {
  if (!s?.trim()) return null;
  const t = s.trim();
  const us = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?/i);
  if (us) {
    let h = Number(us[4] ?? 0);
    if (us[7]) h = (h % 12) + (/pm/i.test(us[7]) ? 12 : 0);
    const d = new Date(Date.UTC(Number(us[3]), Number(us[1]) - 1, Number(us[2]), h, Number(us[5] ?? 0)));
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(t.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function platformOf(url: string | null, header: string[], hint?: string): PerfPlatform | null {
  if (url) {
    if (/instagram\.com/.test(url)) return "instagram";
    if (/facebook\.com|fb\.watch/.test(url)) return "facebook";
    if (/tiktok\.com/.test(url)) return "tiktok";
    if (/youtube\.com|youtu\.be/.test(url)) return "youtube";
  }
  if (hint && ["instagram", "facebook", "tiktok", "youtube"].includes(hint)) return hint as PerfPlatform;
  const h = header.join(" ").toLowerCase();
  if (/account username|saves|reels/.test(h)) return "instagram";
  if (/page name|page id|reactions/.test(h)) return "facebook";
  if (/tiktok|favorites|video title/.test(h)) return "tiktok";
  return null;
}

function kindOf(platform: PerfPlatform, raw: string | undefined, duration: number | null): string | null {
  const k = (raw ?? "").toLowerCase();
  if (/reel/.test(k)) return "reel";
  if (/carousel|album/.test(k)) return "carousel";
  if (/story/.test(k)) return "story";
  if (/live/.test(k)) return "live";
  if (/video/.test(k)) return platform === "facebook" && duration != null && duration <= 90 ? "reel" : "video";
  if (/photo|image|post|status|link|text/.test(k)) return "post";
  if (platform === "tiktok") return "short";
  return k || null;
}

export interface ImportResult {
  kind: "posts" | "daily";
  platforms: Record<string, number>;
  rows: number;
  skipped: number;
  from: string | null;
  to: string | null;
  recognised: string[];
  ignored: string[];
}

export function importCsv(db: DB, text: string, hint?: string): ImportResult {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("That file has no rows. Export it as CSV (not Excel) and try again.");
  // Some exports put a title line above the header: use the first row that has 3+ recognised columns.
  let headerIdx = 0;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    if (rows[i].filter((h) => FIELDS.some(([, re]) => re.test(h.trim()))).length >= 3) { headerIdx = i; break; }
  }
  const header = rows[headerIdx].map((h) => h.trim());
  const col = new Map<Field, number>();
  // Field order is priority: e.g. a real "Views" column wins over "Impressions" wherever it sits.
  const used = new Set<number>();
  for (const [name, re] of FIELDS) {
    if (col.has(name)) continue;
    const i = header.findIndex((h, j) => !used.has(j) && re.test(h));
    if (i >= 0) { col.set(name, i); used.add(i); }
  }
  const recognised = header.filter((_, i) => [...col.values()].includes(i));
  const ignored = header.filter((h, i) => h && ![...col.values()].includes(i));
  const get = (r: string[], f: Field) => (col.has(f) ? r[col.get(f)!]?.trim() : undefined);
  const metric = ["views", "reach", "likes", "comments", "shares", "saves", "followers", "follows", "profileViews"].some((m) => col.has(m as Field));
  if (!metric) throw new Error(`No numbers found. Columns in the file: ${header.slice(0, 12).join(", ")}. Make sure it's a stats export.`);

  const isPosts = col.has("postId") || col.has("url") || col.has("published");
  const out: ImportResult = { kind: isPosts ? "posts" : "daily", platforms: {}, rows: 0, skipped: 0, from: null, to: null, recognised, ignored };
  const track = (p: string, d: string | null) => {
    out.platforms[p] = (out.platforms[p] ?? 0) + 1;
    out.rows++;
    if (d) { if (!out.from || d < out.from) out.from = d; if (!out.to || d > out.to) out.to = d; }
  };

  const tx = db.transaction(() => {
    for (const r of rows.slice(headerIdx + 1)) {
      if (r.length < 2 || /^(total|sum)/i.test(r[0] ?? "")) { out.skipped++; continue; }
      const url = get(r, "url") || null;
      const platform = platformOf(url, header, hint);
      if (!platform) throw new Error("Couldn't tell which platform this file is from — pick it in the list and import again.");
      if (isPosts) {
        const postId = get(r, "postId") || url?.match(/\/(?:p|reel|reels|video|videos|posts|shorts)\/([\w-]+)/)?.[1] || url;
        if (!postId) { out.skipped++; continue; }
        const duration = num(get(r, "duration"));
        const published = parseDate(get(r, "published") ?? get(r, "date"));
        upsertPost(db, {
          platform, postId, url, title: (get(r, "title") || get(r, "caption") || "").replace(/\s+/g, " ").slice(0, 500), kind: kindOf(platform, get(r, "kind"), duration), publishedAt: published,
          durationS: duration, views: num(get(r, "views")), reach: num(get(r, "reach")), likes: num(get(r, "likes")), comments: num(get(r, "comments")),
          shares: num(get(r, "shares")), saves: num(get(r, "saves")), follows: num(get(r, "follows")), thumbnail: null, source: "csv",
        });
        track(platform, published);
      } else {
        const date = parseDate(get(r, "date"))?.slice(0, 10);
        if (!date) { out.skipped++; continue; }
        upsertDaily(db, {
          platform, date, followers: num(get(r, "followers")), views: num(get(r, "views")), likes: num(get(r, "likes")), comments: num(get(r, "comments")),
          shares: num(get(r, "shares")), profileViews: num(get(r, "profileViews")),
        });
        track(platform, date);
      }
    }
  });
  tx();
  return out;
}
