import { describe, expect, it } from "vitest";
import { clusterPending, insertArticle, mergeClusterInto, mergeSimilarClusters } from "@/lib/ingest/pipeline";
import { fromAggregator } from "@/lib/ingest/pipeline";
import { createQuestion, listQuestions } from "@/lib/repo/questions";
import { freshDb } from "./helpers";

const item = (n: number, title: string, h = 1) => ({
  url: `https://ex${n}.example.com/a${n}`, guid: null, title, summary: null, author: null, imageUrl: null,
  publishedAt: new Date(Date.now() - h * 3_600_000).toISOString(),
});

describe("story merging", () => {
  it("folds an untouched duplicate story into the one holding your research", () => {
    const db = freshDb();
    insertArticle(db, { feedId: null, publisher: "A", region: null, language: "en", item: item(1, "Robert Pattinson named the new James Bond", 3) });
    clusterPending(db);
    const first = (db.prepare("SELECT id FROM clusters").get() as { id: string }).id;
    const q = createQuestion(db, { clusterId: first, text: "Who decided?", origin: "user" });
    // A second story created separately (simulating one formed before enough overlap existed).
    db.prepare("INSERT INTO clusters (id, headline, first_seen_at, last_updated_at, created_at, updated_at) VALUES ('story_x', 'x', ?, ?, ?, ?)").run(...Array(4).fill(new Date().toISOString()));
    const r = insertArticle(db, { feedId: null, publisher: "B", region: null, language: "en", item: item(2, "Pattinson confirmed as new James Bond by Amazon") });
    db.prepare("UPDATE articles SET cluster_id = 'story_x' WHERE id = ?").run(r.id);
    db.prepare("UPDATE clusters SET tokens = ?, entities = ? WHERE id = 'story_x'").run(JSON.stringify({ t: ["pattinson", "confirmed", "new", "jame", "bond", "amazon"], a: [] }), JSON.stringify(["Pattinson", "James Bond"]));
    db.prepare("UPDATE clusters SET entities = ? WHERE id = ?").run(JSON.stringify(["Robert Pattinson", "James Bond"]), first);
    expect(mergeSimilarClusters(db)).toBe(1);
    expect(db.prepare("SELECT COUNT(*) AS n FROM clusters").get()).toEqual({ n: 1 });
    expect(listQuestions(db, { clusterId: first }).map((x) => x.id)).toEqual([q.id]);
    expect((db.prepare("SELECT source_count FROM clusters WHERE id = ?").get(first) as { source_count: number }).source_count).toBe(2);
  });

  it("manual merge moves questions with the story", () => {
    const db = freshDb();
    insertArticle(db, { feedId: null, publisher: "A", region: null, language: "en", item: item(1, "Floods hit Sylhet") });
    insertArticle(db, { feedId: null, publisher: "B", region: null, language: "en", item: item(2, "Parliament passes budget in Dhaka") });
    clusterPending(db);
    const [a, b] = (db.prepare("SELECT id FROM clusters ORDER BY headline").all() as { id: string }[]).map((r) => r.id);
    createQuestion(db, { clusterId: a, text: "How many displaced?", origin: "user" });
    mergeClusterInto(db, a, b);
    expect(listQuestions(db, { clusterId: b })).toHaveLength(1);
    expect(db.prepare("SELECT 1 FROM clusters WHERE id = ?").get(a)).toBeUndefined();
  });

  it("credits the real outlet on Google News items", () => {
    const r = fromAggregator(item(1, "Hasina extradition talks denied - The Daily Star"));
    expect(r.publisher).toBe("The Daily Star");
    expect(r.item.title).toBe("Hasina extradition talks denied");
  });
});
