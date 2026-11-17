import type { DB } from "./db";
import { activeChannel, termMatcher } from "./channels";
import { BD } from "./ideation/talk";
import { SPORT } from "./ideation/statements";
import { ingestIntervalMinutes } from "./scheduler";
import { jaccard, uniqueTokens } from "./text";
import { parseJson } from "./db";
import { familiarityDays, isOldNews } from "./ideation/familiarity";

export const SHOWBIZ = /\b(actor|actress|film|movie|box office|celebrity|singer|album|oscars?|grammys?|netflix|hollywood|bollywood|dhallywood|james bond|007|trailer|premiere|royal baby|influencer|reality show|met gala|fashion week)\b/i;

/**
 * What changed since the creator last looked, and what is blowing up right now.
 * Free and local: reads the database only.
 */
export interface LiveStory { id: string; headline: string; sources: number; firstSeenAt: string; why: string }
export interface LiveStatus {
  lastIngestAt: string | null;
  intervalMinutes: number;
  since: string | null;
  newStories: number;
  newEpisodes: number;
  fresh: LiveStory[];
  spiking: LiveStory[];
}

interface Row { id: string; headline: string; summary: string | null; source_count: number; first_seen_at: string; regions: string; entities: string }

export function liveStatus(db: DB, since: string | null): LiveStatus {
  const ch = activeChannel(db);
  const lastIngestAt = (db.prepare("SELECT MAX(started_at) AS t FROM ingest_runs").get() as { t: string | null }).t;
  const sinceIso = since || new Date(Date.now() - 6 * 3_600_000).toISOString();
  const boost = termMatcher(ch.boostTerms);
  const mute = termMatcher(ch.muteTerms);
  const sportsChannel = SPORT.test(`${ch.name} ${ch.profile}`);
  const bad = ch.badExamples.split("\n").map((l) => new Set(uniqueTokens(l.replace(/\(.*?\)/g, "")))).filter((t) => t.size >= 3);
  // Stories this creator would never touch: muted terms, sport, showbiz, look-alikes of their "bores me" examples.
  const unwanted = (r: Row) => {
    const text = `${r.headline} ${r.summary ?? ""}`;
    if (mute(text).length || SHOWBIZ.test(r.headline)) return true;
    if (!sportsChannel && SPORT.test(r.headline)) return true;
    const toks = new Set(uniqueTokens(r.headline));
    return bad.some((b) => jaccard(b, toks) >= 0.25);
  };
  const relevant = (r: Row) => {
    const text = `${r.headline} ${r.summary ?? ""}`;
    if (unwanted(r)) return null;
    const b = boost(text);
    if (b.length) return `Your focus: ${b.slice(0, 2).join(", ")}`;
    if (BD.test(text) || /bangladesh/i.test(r.regions)) return "Bangladesh";
    return null;
  };

  const newStories = (db.prepare("SELECT COUNT(*) AS n FROM clusters WHERE first_seen_at > ? AND is_sample = 0").get(sinceIso) as { n: number }).n;
  const newEpisodes = (
    db.prepare(
      `SELECT COUNT(*) AS n FROM articles a JOIN feeds f ON f.id = a.feed_id WHERE f.category = 'talk' AND a.fetched_at > ? AND COALESCE(a.published_at, a.fetched_at) > datetime('now', '-2 days')`,
    ).get(sinceIso) as { n: number }
  ).n;

  const recent = db
    .prepare(
      `SELECT id, headline, summary, source_count, first_seen_at, regions, entities FROM clusters
       WHERE is_sample = 0 AND state != 'dismissed' AND first_seen_at > datetime('now', '-24 hours')
       ORDER BY source_count DESC LIMIT 300`,
    )
    .all() as Row[];

  const fresh: LiveStory[] = [];
  for (const r of recent) {
    if (r.first_seen_at <= sinceIso || r.source_count < 2) continue;
    const why = relevant(r);
    if (why) fresh.push({ id: r.id, headline: r.headline, sources: r.source_count, firstSeenAt: r.first_seen_at, why });
    if (fresh.length >= 6) break;
  }

  // Spiking: a story picked up by many outlets within a day — in this channel's focus, or simply huge.
  const spiking: LiveStory[] = [];
  const twelveHoursAgo = new Date(Date.now() - 12 * 3_600_000).toISOString();
  for (const r of recent) {
    if (r.first_seen_at < twelveHoursAgo || unwanted(r)) continue;
    const why = relevant(r);
    if (!((why && r.source_count >= 5) || r.source_count >= 20)) continue;
    // A new cluster about an old saga (weeks of coverage of the same people) isn't breaking news.
    if (isOldNews(familiarityDays(db, parseJson<string[]>(r.entities, [])))) continue;
    spiking.push({ id: r.id, headline: r.headline, sources: r.source_count, firstSeenAt: r.first_seen_at, why: why ?? "Everyone is covering it" });
    if (spiking.length >= 3) break;
  }

  return { lastIngestAt, intervalMinutes: ingestIntervalMinutes(), since: since || null, newStories, newEpisodes, fresh, spiking };
}
