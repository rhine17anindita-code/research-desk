import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ingestFeeds, insertArticle, clusterPending } from "@/lib/ingest/pipeline";
import { createChannel, setActiveChannel, setFeedChannel } from "@/lib/channels";
import { rankFeed } from "@/lib/ranking";
import { createIdea, listIdeas } from "@/lib/ideation/repo";
import { findStatements } from "@/lib/ideation/statements";
import { expandPitch, savePitch, writeProposal } from "@/lib/ideation/pitch";
import { isEstimate } from "@/lib/research/ai-tasks";
import { personalContext } from "@/lib/ideation/personal";
import { addFixtureFeeds, fixtureFetcher, freshDb, MockProvider, useMock } from "./helpers";
import type { DB } from "@/lib/db";

describe("channels", () => {
  let db: DB;
  beforeEach(async () => {
    db = freshDb();
    addFixtureFeeds(db);
    await ingestFeeds(db, { fetcher: fixtureFetcher });
  });

  it("keeps sources, ideas and context separate per channel", () => {
    const before = rankFeed(db, { hours: 24 * 3650 }).items.length;
    expect(before).toBeGreaterThan(0);
    createIdea(db, { title: "News idea", hook: null, angle: null, whyUntold: null, whyItLands: null, format: "short-video", angleType: null, backing: { clusters: [], sources: [], questions: [] }, openQuestions: [], effort: null, timeliness: null, origin: "ai", batchId: null, inspirationId: null });
    const culture = createChannel(db, { name: "Culture", template: "blank" });
    setActiveChannel(db, culture.id);
    expect(rankFeed(db, { hours: 24 * 3650 }).items).toHaveLength(0); // no sources yet
    expect(listIdeas(db)).toHaveLength(0);
    expect(personalContext(db)).toContain("CHANNEL: Culture");
    setFeedChannel(db, culture.id, "feed_b", true);
    expect(rankFeed(db, { hours: 24 * 3650 }).items.length).toBeGreaterThan(0);
    setActiveChannel(db, "ch_default");
    expect(listIdeas(db).map((i) => i.title)).toEqual(["News idea"]);
  });
});

describe("statements radar", () => {
  it("attributes quotes to the speaker next to the speech verb", () => {
    const db = freshDb();
    addFixtureFeeds(db);
    insertArticle(db, {
      feedId: "feed_a", publisher: "Alpha News", region: null, language: "en",
      item: { url: "https://alpha.example.com/q", guid: null, title: "Minister threatens ban on river exports", summary: "Minister Rahim Uddin warned: “We will ban every export if the dam goes ahead, no exceptions.” Officials declined to comment.", author: null, publishedAt: new Date().toISOString(), imageUrl: null },
    });
    clusterPending(db);
    const s = findStatements(db, { days: 2 });
    expect(s[0]?.speaker).toBe("Rahim Uddin");
    expect(s[0]?.verb).toBe("warned");
    expect(s[0]?.quote).toMatch(/^We will ban every export/);
  });
});

describe("pitch → expand → proposal", () => {
  let provider: MockProvider;
  afterEach(() => useMock(null));
  it("saves the creator's idea, expands it and writes a proposal", async () => {
    const db = freshDb();
    addFixtureFeeds(db);
    await ingestFeeds(db, { fetcher: fixtureFetcher });
    provider = new MockProvider({
      better_title: () => ({
        better_title: "The River That Two Countries Signed Away", alt_titles: ["Where did the water go?"], logline: "A water deal with no water in it.",
        thumbnail: "Dry riverbed, text: SIGNED AWAY", first_seconds: "They signed a river deal. It doesn't mention water.",
        angles: [{ title: "Follow the dams", angle: "Who builds upstream", hook: "One dam decides." }], outline: [{ heading: "Cold open", beats: ["The empty riverbed"] }],
        next_steps: ["Get the framework text"], to_look_at: [{ what: "Treaty text", why: "Primary source", where: "Ministry website" }], people: ["A hydrologist"], risks: ["Defamation"],
        scores: { hook: 9, mass_appeal: 8, novelty: 8, evidence: 6 },
      }),
      markdown: () => ({ markdown: "# The River That Two Countries Signed Away\n\nSummary…" }),
    });
    useMock(provider);
    const idea = savePitch(db, { text: "A talking-head video on the Amber River water deal and why farmers lose out", format: "talking-head" });
    expect(idea.origin).toBe("user");
    expect(idea.status).toBe("saved");
    expect(idea.backing.clusters.length).toBeGreaterThan(0); // matched the Amber River story locally
    const ex = await expandPitch(db, idea.id);
    expect(!isEstimate(ex) && ex.ok).toBe(true);
    if (!isEstimate(ex) && ex.ok) {
      expect(ex.data.expansion?.angles[0].title).toBe("Follow the dams");
      expect(ex.data.packaging?.titles[0]).toBe("The River That Two Countries Signed Away");
    }
    const pr = await writeProposal(db, idea.id, { recipient: "a broadcaster" });
    expect(!isEstimate(pr) && pr.ok && pr.data.proposal?.startsWith("# The River")).toBe(true);
    expect(provider.calls[1].user).toContain("a broadcaster");
  });
});
