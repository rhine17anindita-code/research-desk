import { jaccard, overlapCoefficient } from "../text";

/**
 * Story clustering: groups coverage of the same underlying development.
 * Pure and deterministic so it can be unit tested; persistence lives in pipeline.ts.
 *
 * An article joins the most similar recent cluster when headlines overlap strongly,
 * or when they share several named entities and meaningful vocabulary.
 */
export interface ClusterFingerprint {
  titleTokens: Set<string>;
  allTokens: Set<string>;
  entities: Set<string>;
  lastUpdated: number; // epoch ms
}

export interface ArticleFingerprint {
  titleTokens: Set<string>;
  allTokens: Set<string>;
  entities: Set<string>;
  publishedAt: number;
}

export const CLUSTER_WINDOW_MS = 72 * 3600 * 1000;

export function similarity(a: ArticleFingerprint, c: ClusterFingerprint): number {
  const t = jaccard(a.titleTokens, c.titleTokens);
  const o = overlapCoefficient(a.titleTokens, c.titleTokens);
  let sharedTitle = 0;
  for (const x of a.titleTokens) if (c.titleTokens.has(x)) sharedTitle++;
  let sharedEntities = 0;
  for (const e of a.entities) if (c.entities.has(e)) sharedEntities++;
  const s = jaccard(a.allTokens, c.allTokens);

  const matched =
    t >= 0.34 ||
    (o >= 0.6 && sharedTitle >= 3) ||
    (sharedEntities >= 2 && s >= 0.16 && sharedTitle >= 2) ||
    (sharedEntities >= 3 && s >= 0.12);
  if (!matched) return 0;
  return t * 0.5 + o * 0.2 + Math.min(sharedEntities, 4) * 0.05 + s * 0.3;
}

/** Return the index of the best-matching cluster, or -1. */
export function findCluster(a: ArticleFingerprint, clusters: ClusterFingerprint[]): number {
  let best = -1;
  let bestScore = 0;
  clusters.forEach((c, i) => {
    if (Math.abs(a.publishedAt - c.lastUpdated) > CLUSTER_WINDOW_MS) return;
    const sc = similarity(a, c);
    if (sc > bestScore) {
      bestScore = sc;
      best = i;
    }
  });
  return best;
}

/** Merge an article's fingerprint into a cluster's (bounded, so clusters don't drift forever). */
export function absorb(c: ClusterFingerprint, a: ArticleFingerprint): void {
  for (const t of a.titleTokens) if (c.titleTokens.size < 60) c.titleTokens.add(t);
  for (const t of a.allTokens) if (c.allTokens.size < 160) c.allTokens.add(t);
  for (const e of a.entities) if (c.entities.size < 30) c.entities.add(e);
  c.lastUpdated = Math.max(c.lastUpdated, a.publishedAt);
}

/** Cluster a batch of articles from scratch (used in tests and re-clustering). Returns cluster index per article. */
export function clusterBatch(articles: ArticleFingerprint[]): number[] {
  const clusters: ClusterFingerprint[] = [];
  const order = articles.map((_, i) => i).sort((x, y) => articles[x].publishedAt - articles[y].publishedAt);
  const assignment = new Array<number>(articles.length);
  for (const i of order) {
    const a = articles[i];
    const idx = findCluster(a, clusters);
    if (idx >= 0) {
      absorb(clusters[idx], a);
      assignment[i] = idx;
    } else {
      clusters.push({
        titleTokens: new Set(a.titleTokens),
        allTokens: new Set(a.allTokens),
        entities: new Set(a.entities),
        lastUpdated: a.publishedAt,
      });
      assignment[i] = clusters.length - 1;
    }
  }
  return assignment;
}
