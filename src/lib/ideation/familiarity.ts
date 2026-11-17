import type { DB } from "../db";

/**
 * How long has the audience been hearing about this? Counts the distinct days in the
 * last 30 on which a story's main names appeared in headlines. A story whose names have
 * been in the news on many different days is "already known" — only a genuinely new
 * angle is worth making about it.
 */
const cache = new Map<string, { at: number; days: number }>();

export function familiarityDays(db: DB, entities: string[]): number {
  const names = entities.filter((e) => e.length > 3).slice(0, 3);
  if (!names.length) return 0;
  const key = names.join("|");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 30 * 60_000) return hit.days;
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  // All main names must co-occur, so "Hasina" + "return" style stories count, not every Hasina mention.
  const match = names.slice(0, 2).map((n) => `"${n.replace(/"/g, "")}"`).join(" AND ");
  let days = 0;
  try {
    days = (db
      .prepare(
        `SELECT COUNT(DISTINCT substr(COALESCE(a.published_at, a.fetched_at), 1, 10)) AS d FROM search_index si JOIN articles a ON a.id = si.ref_id
         WHERE si.kind = 'article' AND search_index MATCH ? AND COALESCE(a.published_at, a.fetched_at) >= ?`,
      )
      .get(match, since) as { d: number }).d;
  } catch {
    days = 0;
  }
  cache.set(key, { at: Date.now(), days });
  return days;
}

export function isOldNews(days: number): boolean {
  return days >= 8;
}
