import type { DB } from "../db";
import { parseJson } from "../db";
import { newId, nowIso } from "../ids";
import { canonicalUrl, extractEntities, titleHash, uniqueTokens, truncate } from "../text";
import { indexItem } from "../repo/search-index";
import { absorb, buildIdf, CLUSTER_WINDOW_MS, findCluster, similarity, type ArticleFingerprint, type ClusterFingerprint, type Idf } from "./cluster";
import { fetchFeedXml, parseFeed, type FeedItem } from "./rss";
import { isGoogleNewsFeed } from "./default-feeds";

export interface FeedRow {
  id: string; name: string; url: string; region: string | null; language: string | null; enabled: number; priority: number;
}

export interface IngestResult {
  runId: string;
  feedsOk: number;
  feedsFailed: number;
  articlesNew: number;
  articlesDuplicate: number;
  clustersNew: number;
  failures: { feed: string; error: string }[];
}

export interface IncomingArticle {
  feedId: string | null;
  publisher: string;
  region: string | null;
  language: string | null;
  item: FeedItem;
  isSample?: boolean;
}

type InsertOutcome = "new" | "duplicate";

/** Insert a single article if it isn't a duplicate. Returns the new id or null. */
export function insertArticle(db: DB, a: IncomingArticle): { outcome: InsertOutcome; id?: string } {
  const canon = canonicalUrl(a.item.url);
  if (db.prepare("SELECT 1 FROM articles WHERE canonical_url = ?").get(canon)) return { outcome: "duplicate" };
  const th = titleHash(a.item.title);
  // Same headline from the same publisher within 3 days = same article under another URL.
  const published = a.item.publishedAt ?? nowIso();
  const dupByTitle = db
    .prepare(
      `SELECT 1 FROM articles WHERE title_hash = ? AND publisher = ?
       AND ABS(julianday(COALESCE(published_at, fetched_at)) - julianday(?)) < 3`,
    )
    .get(th, a.publisher, published);
  if (dupByTitle) return { outcome: "duplicate" };

  const id = newId("art");
  const now = nowIso();
  const entities = extractEntities(`${a.item.title}. ${a.item.summary ?? ""}`, 10);
  db.prepare(
    `INSERT INTO articles (id, feed_id, url, canonical_url, guid, title, summary, author, publisher, published_at, fetched_at,
      language, region, image_url, title_hash, entities, is_sample, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, a.feedId, a.item.url, canon, a.item.guid, a.item.title, a.item.summary, a.item.author, a.publisher,
    a.item.publishedAt, now, a.language, a.region, a.item.imageUrl, th, JSON.stringify(entities), a.isSample ? 1 : 0, now,
  );
  indexItem(db, "article", id, a.item.title, `${a.item.summary ?? ""} ${a.publisher}`);
  return { outcome: "new", id };
}

interface ArticleRow {
  id: string; title: string; summary: string | null; publisher: string | null; region: string | null;
  published_at: string | null; fetched_at: string; entities: string; is_sample: number; feed_id: string | null;
}

function fingerprint(a: ArticleRow): ArticleFingerprint {
  return {
    titleTokens: new Set(uniqueTokens(a.title)),
    allTokens: new Set(uniqueTokens(`${a.title} ${a.summary ?? ""}`)),
    entities: new Set(parseJson<string[]>(a.entities, [])),
    publishedAt: new Date(a.published_at ?? a.fetched_at).getTime(),
  };
}

/** Assign every unclustered article to an existing or new cluster, then refresh cluster metadata. */
export function clusterPending(db: DB): { clustersNew: number; touched: string[] } {
  const pending = db
    .prepare("SELECT * FROM articles WHERE cluster_id IS NULL ORDER BY COALESCE(published_at, fetched_at) ASC")
    .all() as ArticleRow[];
  if (!pending.length) return { clustersNew: 0, touched: [] };

  const oldest = pending.reduce((m, a) => Math.min(m, new Date(a.published_at ?? a.fetched_at).getTime()), Date.now());
  const since = new Date(oldest - CLUSTER_WINDOW_MS).toISOString();
  const existing = db
    .prepare("SELECT id, tokens, entities, last_updated_at FROM clusters WHERE last_updated_at >= ?")
    .all(since) as { id: string; tokens: string; entities: string; last_updated_at: string }[];

  const ids: string[] = [];
  const fps: ClusterFingerprint[] = [];
  for (const c of existing) {
    const tok = parseJson<{ t: string[]; a: string[] }>(c.tokens, { t: [], a: [] });
    ids.push(c.id);
    fps.push({ titleTokens: new Set(tok.t), allTokens: new Set(tok.a), entities: new Set(parseJson<string[]>(c.entities, [])), lastUpdated: new Date(c.last_updated_at).getTime() });
  }

  const idf = recentIdf(db, oldest);
  const touched = new Set<string>();
  let clustersNew = 0;
  const now = nowIso();
  const setCluster = db.prepare("UPDATE articles SET cluster_id = ? WHERE id = ?");

  db.transaction(() => {
    for (const a of pending) {
      const fp = fingerprint(a);
      const idx = findCluster(fp, fps, idf);
      let cid: string;
      if (idx >= 0) {
        absorb(fps[idx], fp);
        cid = ids[idx];
      } else {
        cid = newId("story");
        const ts = new Date(fp.publishedAt).toISOString();
        db.prepare(
          `INSERT INTO clusters (id, headline, summary, first_seen_at, last_updated_at, is_sample, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(cid, a.title, a.summary, ts, ts, a.is_sample, now, now);
        ids.push(cid);
        fps.push({ titleTokens: new Set(fp.titleTokens), allTokens: new Set(fp.allTokens), entities: new Set(fp.entities), lastUpdated: fp.publishedAt });
        clustersNew++;
      }
      setCluster.run(cid, a.id);
      touched.add(cid);
    }
    for (const cid of touched) {
      const fp = fps[ids.indexOf(cid)];
      refreshCluster(db, cid, fp);
    }
  })();
  mergeSimilarClusters(db, [...touched], idf);
  return { clustersNew, touched: [...touched] };
}

const PROTECTED_SQL = `(c.state != 'new' OR c.rating != 0 OR c.ai_brief IS NOT NULL
  OR EXISTS (SELECT 1 FROM questions q WHERE q.cluster_id = c.id)
  OR EXISTS (SELECT 1 FROM notes n WHERE n.cluster_id = c.id)
  OR EXISTS (SELECT 1 FROM project_items p WHERE p.item_type = 'cluster' AND p.item_id = c.id)
  OR EXISTS (SELECT 1 FROM links l WHERE (l.from_type = 'cluster' AND l.from_id = c.id) OR (l.to_type = 'cluster' AND l.to_id = c.id))
  OR EXISTS (SELECT 1 FROM chat_threads t WHERE t.context_type = 'cluster' AND t.context_id = c.id))`;

/** Move every article of `from` into `into` and refresh both (the empty one is deleted). */
export function mergeClusterInto(db: DB, from: string, into: string): void {
  if (from === into) return;
  db.transaction(() => {
    db.prepare("UPDATE articles SET cluster_id = ? WHERE cluster_id = ?").run(into, from);
    // Carry over any research attached to the absorbed story.
    db.prepare("UPDATE questions SET cluster_id = ? WHERE cluster_id = ?").run(into, from);
    db.prepare("UPDATE notes SET cluster_id = ? WHERE cluster_id = ?").run(into, from);
    db.prepare("UPDATE OR IGNORE project_items SET item_id = ? WHERE item_type = 'cluster' AND item_id = ?").run(into, from);
    db.prepare("DELETE FROM project_items WHERE item_type = 'cluster' AND item_id = ?").run(from);
    db.prepare("UPDATE OR IGNORE links SET from_id = ? WHERE from_type = 'cluster' AND from_id = ?").run(into, from);
    db.prepare("UPDATE OR IGNORE links SET to_id = ? WHERE to_type = 'cluster' AND to_id = ?").run(into, from);
    db.prepare("DELETE FROM links WHERE (from_type = 'cluster' AND from_id = ?) OR (to_type = 'cluster' AND to_id = ?)").run(from, from);
    db.prepare("UPDATE chat_threads SET context_id = ? WHERE context_type = 'cluster' AND context_id = ?").run(into, from);
    const f = db.prepare("SELECT state, rating FROM clusters WHERE id = ?").get(from) as { state: string; rating: number } | undefined;
    if (f && f.state === "saved") db.prepare("UPDATE clusters SET state = 'saved' WHERE id = ? AND state = 'new'").run(into);
    if (f && f.rating) db.prepare("UPDATE clusters SET rating = ? WHERE id = ? AND rating = 0").run(f.rating, into);
    db.prepare("DELETE FROM feedback WHERE cluster_id = ?").run(from);
    db.prepare("DELETE FROM search_index WHERE kind = 'cluster' AND ref_id = ?").run(from);
    refreshCluster(db, into);
    refreshCluster(db, from);
  })();
}

/**
 * Combine stories that turn out to cover the same event (e.g. both formed before
 * enough coverage arrived). Automatic merges never combine two stories that both hold
 * your work; an untouched story is folded into the one you have worked on.
 */
export function mergeSimilarClusters(db: DB, focusIds?: string[], idf?: Idf): number {
  const since = new Date(Date.now() - 5 * 86_400_000).toISOString();
  const rows = db
    .prepare(`SELECT c.id, c.tokens, c.entities, c.last_updated_at, c.article_count, ${PROTECTED_SQL} AS protected FROM clusters c WHERE c.last_updated_at >= ?`)
    .all(since) as { id: string; tokens: string; entities: string; last_updated_at: string; article_count: number; protected: number }[];
  const fp = new Map(
    rows.map((r) => {
      const tok = parseJson<{ t: string[]; a: string[] }>(r.tokens, { t: [], a: [] });
      return [r.id, { titleTokens: new Set(tok.t), allTokens: new Set(tok.a), entities: new Set(parseJson<string[]>(r.entities, [])), lastUpdated: new Date(r.last_updated_at).getTime() }];
    }),
  );
  const focusSet = focusIds ? new Set(focusIds) : null;
  const focus = focusSet ? rows.filter((r) => focusSet.has(r.id)) : rows;
  const byId = new Map(rows.map((r) => [r.id, r]));
  // Inverted index: only compare stories sharing at least two headline words.
  const index = new Map<string, string[]>();
  for (const r of rows) for (const t of fp.get(r.id)!.titleTokens) (index.get(t) ?? index.set(t, []).get(t)!).push(r.id);
  const gone = new Set<string>();
  let merged = 0;
  for (const a of focus) {
    if (gone.has(a.id)) continue;
    const shared = new Map<string, number>();
    for (const t of fp.get(a.id)!.titleTokens) for (const id of index.get(t) ?? []) shared.set(id, (shared.get(id) ?? 0) + 1);
    const candidates = [...shared.entries()].filter(([id, n]) => n >= 2 && id !== a.id).map(([id]) => byId.get(id)!);
    for (const b of candidates) {
      if (a.id === b.id || gone.has(b.id) || gone.has(a.id)) continue;
      if (a.protected && b.protected) continue;
      const fa = fp.get(a.id)!;
      const fb = fp.get(b.id)!;
      // Compare the smaller story (as if it were one article) against the larger.
      const [small, large] = a.article_count <= b.article_count ? [a, b] : [b, a];
      const fs = fp.get(small.id)!;
      const sim = Math.min(
        similarity({ titleTokens: fs.titleTokens, allTokens: fs.allTokens, entities: fs.entities, publishedAt: fs.lastUpdated }, fp.get(large.id)!, idf),
        1,
      );
      if (sim <= 0 || Math.abs(fa.lastUpdated - fb.lastUpdated) > CLUSTER_WINDOW_MS) continue;
      // Keep the protected story; otherwise keep the larger one.
      const [from, into] = small.protected ? [large, small] : [small, large];
      mergeClusterInto(db, from.id, into.id);
      gone.add(from.id);
      const fi = fp.get(into.id)!;
      const ff = fp.get(from.id)!;
      for (const t of ff.titleTokens) fi.titleTokens.add(t);
      for (const t of ff.allTokens) fi.allTokens.add(t);
      for (const e of ff.entities) fi.entities.add(e);
      into.article_count += from.article_count;
      merged++;
    }
  }
  return merged;
}

/** Word rarity over headlines from the week around `around` (epoch ms). */
function recentIdf(db: DB, around: number): Idf {
  const from = new Date(around - 7 * 86_400_000).toISOString();
  const rows = db.prepare("SELECT title FROM articles WHERE COALESCE(published_at, fetched_at) >= ?").all(from) as { title: string }[];
  return buildIdf(rows.map((r) => new Set(uniqueTokens(r.title))));
}

/**
 * Regroup recent stories with the current clustering rules. Stories that hold any of
 * your work (saved, rated, questions, notes, links, projects, AI brief) are kept as they
 * are; only untouched stories are dissolved and their articles re-clustered.
 */
export function reclusterRecent(db: DB, days = 4): { before: number; after: number; kept: number } {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const candidates = db
    .prepare(
      `SELECT c.id FROM clusters c WHERE c.last_updated_at >= ? AND c.state = 'new' AND c.rating = 0 AND c.ai_brief IS NULL
         AND NOT EXISTS (SELECT 1 FROM questions q WHERE q.cluster_id = c.id)
         AND NOT EXISTS (SELECT 1 FROM notes n WHERE n.cluster_id = c.id)
         AND NOT EXISTS (SELECT 1 FROM project_items p WHERE p.item_type = 'cluster' AND p.item_id = c.id)
         AND NOT EXISTS (SELECT 1 FROM links l WHERE (l.from_type = 'cluster' AND l.from_id = c.id) OR (l.to_type = 'cluster' AND l.to_id = c.id))
         AND NOT EXISTS (SELECT 1 FROM chat_threads t WHERE t.context_type = 'cluster' AND t.context_id = c.id)`,
    )
    .all(since) as { id: string }[];
  const total = (db.prepare("SELECT COUNT(*) AS n FROM clusters WHERE last_updated_at >= ?").get(since) as { n: number }).n;
  db.transaction(() => {
    const arts = db.prepare("SELECT id, title, summary FROM articles WHERE cluster_id = ?");
    const upd = db.prepare("UPDATE articles SET cluster_id = NULL, entities = ? WHERE id = ?");
    for (const { id } of candidates) {
      for (const a of arts.all(id) as { id: string; title: string; summary: string | null }[]) {
        upd.run(JSON.stringify(extractEntities(`${a.title}. ${a.summary ?? ""}`, 10)), a.id);
      }
      db.prepare("DELETE FROM search_index WHERE kind = 'cluster' AND ref_id = ?").run(id);
      db.prepare("DELETE FROM feedback WHERE cluster_id = ?").run(id);
      db.prepare("DELETE FROM clusters WHERE id = ?").run(id);
    }
  })();
  clusterPending(db);
  mergeSimilarClusters(db, undefined, recentIdf(db, Date.now()));
  const after = (db.prepare("SELECT COUNT(*) AS n FROM clusters WHERE last_updated_at >= ?").get(since) as { n: number }).n;
  return { before: total, after, kept: total - candidates.length };
}

/** Recompute headline, summary, counts, dates and the search index entry for one cluster. */
export function refreshCluster(db: DB, clusterId: string, fp?: ClusterFingerprint): void {
  const arts = db
    .prepare(
      `SELECT a.id, a.title, a.summary, a.publisher, a.region, a.published_at, a.fetched_at, a.entities, a.is_sample, a.feed_id,
              COALESCE(f.priority, 1) AS priority
       FROM articles a LEFT JOIN feeds f ON f.id = a.feed_id WHERE a.cluster_id = ?
       ORDER BY COALESCE(a.published_at, a.fetched_at) ASC`,
    )
    .all(clusterId) as (ArticleRow & { priority: number })[];
  if (!arts.length) {
    db.prepare("DELETE FROM clusters WHERE id = ?").run(clusterId);
    return;
  }
  // Headline: the one sharing the most vocabulary with the others (most "central"), tie-break by feed priority.
  const toks = arts.map((a) => new Set(uniqueTokens(a.title)));
  let bestIdx = 0;
  let bestScore = -1;
  arts.forEach((a, i) => {
    let s = 0;
    toks.forEach((t, j) => {
      if (i === j) return;
      for (const x of toks[i]) if (t.has(x)) s++;
    });
    s += a.priority * 0.5;
    if (s > bestScore) { bestScore = s; bestIdx = i; }
  });
  const summaries = arts.map((a) => a.summary ?? "").filter((s) => s.length > 40).sort((x, y) => y.length - x.length);
  const summary = arts[bestIdx].summary && arts[bestIdx].summary!.length > 80
    ? truncate(arts[bestIdx].summary!, 600)
    : summaries.length ? truncate(summaries[0], 600) : arts[bestIdx].summary;
  const publishers = new Set(arts.map((a) => a.publisher ?? "Unknown"));
  const regions = [...new Set(arts.map((a) => a.region).filter(Boolean))];
  const entityCounts = new Map<string, number>();
  for (const a of arts) for (const e of parseJson<string[]>(a.entities, [])) entityCounts.set(e, (entityCounts.get(e) ?? 0) + 1);
  const entities = [...entityCounts.entries()].sort((a, b) => b[1] - a[1]).map(([e]) => e).slice(0, 15);
  const f = fp ?? {
    titleTokens: new Set(toks.flatMap((t) => [...t])),
    allTokens: new Set(arts.flatMap((a) => uniqueTokens(`${a.title} ${a.summary ?? ""}`))),
    entities: new Set(entities),
    lastUpdated: 0,
  };
  const first = arts[0];
  const last = arts[arts.length - 1];
  db.prepare(
    `UPDATE clusters SET headline = ?, summary = ?, first_seen_at = ?, last_updated_at = ?, article_count = ?, source_count = ?,
      tokens = ?, entities = ?, regions = ?, is_sample = ?, updated_at = ? WHERE id = ?`,
  ).run(
    arts[bestIdx].title,
    summary,
    first.published_at ?? first.fetched_at,
    last.published_at ?? last.fetched_at,
    arts.length,
    publishers.size,
    JSON.stringify({ t: [...f.titleTokens].slice(0, 60), a: [...f.allTokens].slice(0, 160) }),
    JSON.stringify(entities),
    JSON.stringify(regions),
    arts.every((a) => a.is_sample) ? 1 : 0,
    nowIso(),
    clusterId,
  );
  indexItem(
    db,
    "cluster",
    clusterId,
    arts[bestIdx].title,
    `${summary ?? ""} ${arts.map((a) => a.title).join(" ")} ${[...publishers].join(" ")} ${entities.join(" ")}`,
  );
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

/**
 * Google News items carry the real outlet in the headline ("Headline - Outlet") and a
 * description that only repeats the headline. Credit the real outlet so story clusters
 * count outlets correctly.
 */
export function fromAggregator(item: FeedItem): { item: FeedItem; publisher: string } {
  const m = item.title.match(/^(.*\S)\s+[-–—]\s+([^-–—]{2,60})$/);
  const title = m ? m[1] : item.title;
  const publisher = m ? m[2].trim() : "Google News";
  const summary = item.summary && !item.summary.startsWith(title.slice(0, 40)) ? item.summary : null;
  return { item: { ...item, title, summary }, publisher };
}

let running: Promise<IngestResult> | null = null;

/** Fetch all enabled feeds (or a subset), store new articles and cluster them. Concurrent calls share one run. */
export function ingestFeeds(db: DB, opts: { feedIds?: string[]; trigger?: string; fetcher?: (url: string) => Promise<string> } = {}): Promise<IngestResult> {
  if (running) return running;
  running = doIngest(db, opts).finally(() => {
    running = null;
  });
  return running;
}

async function doIngest(db: DB, opts: { feedIds?: string[]; trigger?: string; fetcher?: (url: string) => Promise<string> }): Promise<IngestResult> {
  const runId = newId("run");
  db.prepare("INSERT INTO ingest_runs (id, started_at, trigger) VALUES (?, ?, ?)").run(runId, nowIso(), opts.trigger ?? "manual");
  let feeds = db.prepare("SELECT id, name, url, region, language, enabled, priority FROM feeds WHERE enabled = 1").all() as FeedRow[];
  if (opts.feedIds?.length) {
    feeds = db.prepare(`SELECT id, name, url, region, language, enabled, priority FROM feeds WHERE id IN (${opts.feedIds.map(() => "?").join(",")})`).all(...opts.feedIds) as FeedRow[];
  }
  const fetcher = opts.fetcher ?? fetchFeedXml;
  const result: IngestResult = { runId, feedsOk: 0, feedsFailed: 0, articlesNew: 0, articlesDuplicate: 0, clustersNew: 0, failures: [] };

  await mapLimit(feeds, 6, async (feed) => {
    try {
      const xml = await fetcher(feed.url);
      const parsed = await parseFeed(xml);
      let fresh = 0;
      db.transaction(() => {
        const aggregator = isGoogleNewsFeed(feed.url);
        for (const raw of parsed.items.slice(0, 80)) {
          const { item, publisher } = aggregator ? fromAggregator(raw) : { item: raw, publisher: feed.name };
          const r = insertArticle(db, { feedId: feed.id, publisher, region: feed.region, language: feed.language, item });
          if (r.outcome === "new") { fresh++; result.articlesNew++; } else result.articlesDuplicate++;
        }
      })();
      db.prepare("UPDATE feeds SET last_fetched_at = ?, last_status = 'ok', last_error = NULL, last_item_count = ?, updated_at = ? WHERE id = ?")
        .run(nowIso(), parsed.items.length, nowIso(), feed.id);
      result.feedsOk++;
      return fresh;
    } catch (err) {
      const msg = (err as Error).message?.slice(0, 300) || "Unknown error";
      db.prepare("UPDATE feeds SET last_fetched_at = ?, last_status = 'error', last_error = ?, updated_at = ? WHERE id = ?")
        .run(nowIso(), msg, nowIso(), feed.id);
      result.feedsFailed++;
      result.failures.push({ feed: feed.name, error: msg });
      return 0;
    }
  });

  result.clustersNew = clusterPending(db).clustersNew;
  db.prepare(
    `UPDATE ingest_runs SET finished_at = ?, feeds_ok = ?, feeds_failed = ?, articles_new = ?, articles_duplicate = ?, clusters_new = ? WHERE id = ?`,
  ).run(nowIso(), result.feedsOk, result.feedsFailed, result.articlesNew, result.articlesDuplicate, result.clustersNew, runId);
  return result;
}
