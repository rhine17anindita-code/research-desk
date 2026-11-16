import { beforeEach, describe, expect, it } from "vitest";
import { rankFeed, recordFeedback, scoreCluster, type RankPrefs } from "@/lib/ranking";
import { BUILTIN_SIGNALS, detectSignals } from "@/lib/signals";
import { ingestFeeds } from "@/lib/ingest/pipeline";
import { addFixtureFeeds, fixtureFetcher, freshDb } from "./helpers";
import type { DB } from "@/lib/db";

const prefs = (over: Partial<RankPrefs> = {}): RankPrefs => ({
  signals: BUILTIN_SIGNALS.map((s) => ({ id: s.id, label: s.label, cues: s.cues, weight: 1, learned: 0, enabled: 1 })),
  rules: [],
  termWeights: new Map(),
  regionWeights: {},
  now: Date.now(),
  ...over,
});

const input = (headline: string, extra = {}) => ({
  headline, text: headline, publishers: ["A"], regions: ["Global"], sourceCount: 1, articleCount: 1, lastUpdated: Date.now(), avgFeedPriority: 1, tokens: [], rating: 0, ...extra,
});

describe("editorial signals", () => {
  it("detects cues with word boundaries", () => {
    const m = detectSignals("Ministry denies report, details were not disclosed", BUILTIN_SIGNALS);
    expect(m.map((x) => x.signalId)).toEqual(expect.arrayContaining(["contradiction", "unclear-meaning"]));
    expect(detectSignals("Singapore weather today", BUILTIN_SIGNALS).find((x) => x.signalId === "structural-problem")).toBeUndefined();
  });
});

describe("scoring", () => {
  it("ranks signal-rich, widely covered stories above routine ones", () => {
    const a = scoreCluster(input("Ministry denies contract was awarded without tender", { sourceCount: 4 }), prefs());
    const b = scoreCluster(input("Weekend weather forecast"), prefs());
    expect(a.total).toBeGreaterThan(b.total);
    expect(a.parts.map((p) => p.label)).toContain("Editorial signals");
  });

  it("applies hide and boost rules transparently", () => {
    const p = prefs({ rules: [
      { id: "r1", name: "no sport", action: "hide", field: "any", pattern: "football", weight: 0, enabled: 1 },
      { id: "r2", name: "teesta", action: "boost", field: "title", pattern: "Teesta", weight: 5, enabled: 1 },
    ] });
    expect(scoreCluster(input("Football final tonight"), p).hidden).toBe(true);
    const s = scoreCluster(input("Teesta water talks resume"), p);
    expect(s.ruleHits).toContain("teesta");
    expect(s.parts.find((x) => x.label === "Rule: teesta")?.value).toBe(5);
  });

  it("survives an invalid regex rule", () => {
    const p = prefs({ rules: [{ id: "r", name: "bad", action: "boost", field: "any", pattern: "([", weight: 1, enabled: 1 }] });
    expect(() => scoreCluster(input("x ([ y"), p)).not.toThrow();
  });
});

describe("feedback learning", () => {
  let db: DB;
  beforeEach(async () => {
    db = freshDb();
    addFixtureFeeds(db);
    await ingestFeeds(db, { fetcher: fixtureFetcher });
  });

  it("moves liked topics up and learns signal weights from reasons", () => {
    const feed = rankFeed(db, { hours: 24 * 3650 }).items;
    const port = feed.find((i) => i.headline.includes("Calder"))!;
    const before = port.score.total;
    recordFeedback(db, port.id, "interesting", ["power-incentives"]);
    const after = rankFeed(db, { hours: 24 * 3650 }).items.find((i) => i.id === port.id)!;
    expect(after.score.total).toBeGreaterThan(before);
    const learned = (db.prepare("SELECT learned FROM signals WHERE id = 'power-incentives'").get() as { learned: number }).learned;
    expect(learned).toBeGreaterThan(0);
  });

  it("dismissed stories leave the ranked feed but appear under hidden", () => {
    const first = rankFeed(db, { hours: 24 * 3650 }).items[0];
    recordFeedback(db, first.id, "dismiss");
    expect(rankFeed(db, { hours: 24 * 3650 }).items.some((i) => i.id === first.id)).toBe(false);
    expect(rankFeed(db, { view: "dismissed" }).items.some((i) => i.id === first.id)).toBe(true);
  });
});
