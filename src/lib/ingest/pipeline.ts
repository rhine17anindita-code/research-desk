import type { DB } from "../db";
import { parseJson } from "../db";
import { newId, nowIso } from "../ids";
import { canonicalUrl, extractEntities, titleHash, uniqueTokens, truncate } from "../text";
import { indexItem } from "../repo/search-index";
import { absorb, CLUSTER_WINDOW_MS, findCluster, type ArticleFingerprint, type ClusterFingerprint } from "./cluster";
import { fetchFeedXml, parseFeed, type FeedItem } from "./rss";

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

  const touched = new Set<string>();
  let clustersNew = 0;
  const now = nowIso();
  const setCluster = db.prepare("UPDATE articles SET cluster_id = ? WHERE id = ?");

  db.transaction(() => {
    for (const a of pending) {
      const fp = fingerprint(a);
      const idx = findCluster(fp, fps);
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
  return { clustersNew, touched: [...touched] };
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
        for (const item of parsed.items.slice(0, 80)) {
          const r = insertArticle(db, { feedId: feed.id, publisher: feed.name, region: feed.region, language: feed.language, item });
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
