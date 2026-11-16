import type { DB } from "../db";
import { parseJson } from "../db";
import { nowIso } from "../ids";
import type { Article, Story } from "../types";
import { jaccard } from "../text";

interface ClusterRow {
  id: string; headline: string; summary: string | null; first_seen_at: string; last_updated_at: string; article_count: number;
  source_count: number; entities: string; regions: string; state: Story["state"]; rating: number; is_sample: number;
  ai_brief: string | null; ai_assessment: string | null; tokens: string;
}

export function mapStory(r: ClusterRow): Story {
  return {
    id: r.id,
    headline: r.headline,
    summary: r.summary,
    firstSeenAt: r.first_seen_at,
    lastUpdatedAt: r.last_updated_at,
    articleCount: r.article_count,
    sourceCount: r.source_count,
    entities: parseJson(r.entities, []),
    regions: parseJson(r.regions, []),
    state: r.state,
    rating: r.rating,
    isSample: !!r.is_sample,
    brief: parseJson(r.ai_brief, null),
    assessment: parseJson(r.ai_assessment, null),
  };
}

interface ArticleRow {
  id: string; feed_id: string | null; cluster_id: string | null; url: string; title: string; summary: string | null; author: string | null;
  publisher: string | null; published_at: string | null; fetched_at: string; region: string | null; image_url: string | null; entities: string; is_sample: number;
}

export function mapArticle(r: ArticleRow): Article {
  return {
    id: r.id, feedId: r.feed_id, clusterId: r.cluster_id, url: r.url, title: r.title, summary: r.summary, author: r.author,
    publisher: r.publisher, publishedAt: r.published_at, fetchedAt: r.fetched_at, region: r.region, imageUrl: r.image_url,
    entities: parseJson(r.entities, []), isSample: !!r.is_sample,
  };
}

export function getStory(db: DB, id: string): Story | null {
  const r = db.prepare("SELECT * FROM clusters WHERE id = ?").get(id) as ClusterRow | undefined;
  return r ? mapStory(r) : null;
}

export function markViewed(db: DB, id: string): void {
  db.prepare("UPDATE clusters SET last_viewed_at = ? WHERE id = ?").run(nowIso(), id);
}

export function getStoryArticles(db: DB, clusterId: string): Article[] {
  return (db.prepare("SELECT * FROM articles WHERE cluster_id = ? ORDER BY COALESCE(published_at, fetched_at) ASC").all(clusterId) as ArticleRow[]).map(mapArticle);
}

export function getArticle(db: DB, id: string): Article | null {
  const r = db.prepare("SELECT * FROM articles WHERE id = ?").get(id) as ArticleRow | undefined;
  return r ? mapArticle(r) : null;
}

/** Stories sharing entities/vocabulary with this one (any time), computed locally. */
export function relatedStories(db: DB, clusterId: string, limit = 6): { story: Story; score: number; shared: string[] }[] {
  const base = db.prepare("SELECT * FROM clusters WHERE id = ?").get(clusterId) as ClusterRow | undefined;
  if (!base) return [];
  const baseEnt = new Set(parseJson<string[]>(base.entities, []));
  const baseTok = new Set(parseJson<{ t: string[] }>(base.tokens, { t: [] }).t);
  if (!baseEnt.size && !baseTok.size) return [];
  const terms = [...baseEnt].slice(0, 6).map((e) => `"${e.replace(/"/g, "")}"`);
  if (!terms.length) return [];
  const candidates = db
    .prepare(
      `SELECT c.* FROM clusters c WHERE c.id != ? AND c.id IN (SELECT ref_id FROM search_index WHERE kind = 'cluster' AND search_index MATCH ? LIMIT 200)`,
    )
    .all(clusterId, terms.join(" OR ")) as ClusterRow[];
  return candidates
    .map((c) => {
      const ent = parseJson<string[]>(c.entities, []);
      const shared = ent.filter((e) => baseEnt.has(e));
      const tok = parseJson<{ t: string[] }>(c.tokens, { t: [] }).t;
      const score = shared.length * 0.5 + jaccard(baseTok, tok) * 3;
      return { story: mapStory(c), score, shared };
    })
    .filter((x) => x.shared.length >= 1 && x.score >= 0.7)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function recentlyViewed(db: DB, limit = 12): Story[] {
  return (db.prepare("SELECT * FROM clusters WHERE last_viewed_at IS NOT NULL ORDER BY last_viewed_at DESC LIMIT ?").all(limit) as ClusterRow[]).map(mapStory);
}

/** Stories with research attached (questions, saved, or in a project). */
export function storiesUnderInvestigation(db: DB, limit = 50): (Story & { questionCount: number; answeredCount: number })[] {
  const rows = db
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM questions q WHERE q.cluster_id = c.id AND q.archived = 0) AS qn,
              (SELECT COUNT(DISTINCT a.question_id) FROM answers a JOIN questions q ON q.id = a.question_id WHERE q.cluster_id = c.id) AS an
       FROM clusters c
       WHERE c.state = 'saved' OR EXISTS (SELECT 1 FROM questions q WHERE q.cluster_id = c.id)
          OR EXISTS (SELECT 1 FROM project_items p WHERE p.item_type = 'cluster' AND p.item_id = c.id)
       ORDER BY COALESCE(c.last_viewed_at, c.updated_at) DESC LIMIT ?`,
    )
    .all(limit) as (ClusterRow & { qn: number; an: number })[];
  return rows.map((r) => ({ ...mapStory(r), questionCount: r.qn, answeredCount: r.an }));
}
