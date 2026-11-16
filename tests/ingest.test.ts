import { beforeEach, describe, expect, it } from "vitest";
import { parseFeed } from "@/lib/ingest/rss";
import { ingestFeeds } from "@/lib/ingest/pipeline";
import { addFixtureFeeds, fixture, fixtureFetcher, freshDb } from "./helpers";
import type { DB } from "@/lib/db";

describe("feed parsing", () => {
  it("parses RSS, strips HTML, skips items without a title", async () => {
    const f = await parseFeed(fixture("feed-a.xml"));
    expect(f.title).toBe("Alpha News");
    expect(f.items).toHaveLength(2);
    expect(f.items[0].summary).toMatch(/^The two governments/);
    expect(f.items[0].publishedAt).toBe("2026-11-16T08:00:00.000Z");
  });

  it("parses Atom and tolerates bare ampersands", async () => {
    const f = await parseFeed(fixture("feed-b.xml"));
    expect(f.items).toHaveLength(2);
    expect(f.items[0].url).toBe("https://beta.example.org/2026/11/16/amber-river");
    const a = await parseFeed(fixture("feed-a.xml"));
    expect(a.items[1].summary).toContain("&");
  });
});

describe("ingestion pipeline", () => {
  let db: DB;
  beforeEach(() => {
    db = freshDb();
    addFixtureFeeds(db);
  });

  it("stores articles, clusters coverage across outlets, and records feed failures", async () => {
    const r = await ingestFeeds(db, { fetcher: fixtureFetcher });
    expect(r.feedsOk).toBe(2);
    expect(r.feedsFailed).toBe(1);
    expect(r.failures[0].feed).toBe("Broken Feed");
    expect(r.articlesNew).toBe(4);
    // Amber River coverage from both outlets joins one story.
    const amber = db.prepare("SELECT * FROM clusters WHERE headline LIKE '%Amber River%'").all() as { source_count: number }[];
    expect(amber).toHaveLength(1);
    expect(amber[0].source_count).toBe(2);
    expect(r.clustersNew).toBe(3);
    const failed = db.prepare("SELECT last_status, last_error FROM feeds WHERE id = 'feed_c'").get() as { last_status: string; last_error: string };
    expect(failed.last_status).toBe("error");
  });

  it("deduplicates on re-ingest, including tracking-parameter URL variants", async () => {
    await ingestFeeds(db, { fetcher: fixtureFetcher });
    const r2 = await ingestFeeds(db, { fetcher: fixtureFetcher });
    expect(r2.articlesNew).toBe(0);
    expect(r2.articlesDuplicate).toBe(4);
    const urls = db.prepare("SELECT canonical_url FROM articles").all() as { canonical_url: string }[];
    expect(urls.map((u) => u.canonical_url)).toContain("https://alpha.example.com/world/amber-river-deal");
  });

  it("indexes stories for local search", async () => {
    await ingestFeeds(db, { fetcher: fixtureFetcher });
    const hits = db.prepare("SELECT kind FROM search_index WHERE search_index MATCH 'tender'").all();
    expect(hits.length).toBeGreaterThan(0);
  });
});
