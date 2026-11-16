import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ingestFeeds } from "@/lib/ingest/pipeline";
import { findOpportunities } from "@/lib/ideation/opportunities";
import { generateIdeas, updateTasteSummary } from "@/lib/ideation/ai";
import { developIdea } from "@/lib/ideation/develop";
import { createInspiration, getIdea, listIdeas, recordTaste, tagsOf, tasteStats, updateIdea } from "@/lib/ideation/repo";
import { personalContext } from "@/lib/ideation/personal";
import { listQuestions } from "@/lib/repo/questions";
import { projectItemIds } from "@/lib/repo/projects";
import { setSetting } from "@/lib/repo/settings";
import { isEstimate } from "@/lib/research/ai-tasks";
import { addFixtureFeeds, fixtureFetcher, freshDb, MockProvider, useMock } from "./helpers";
import type { DB } from "@/lib/db";

describe("ideation", () => {
  let db: DB;
  let provider: MockProvider;
  beforeEach(async () => {
    db = freshDb();
    addFixtureFeeds(db);
    // Make the fixture stories recent so they fall inside the opportunity window.
    await ingestFeeds(db, { fetcher: fixtureFetcher });
    db.prepare("UPDATE clusters SET last_updated_at = ?").run(new Date().toISOString());
    db.prepare("UPDATE feeds SET category = 'regional'").run();
    provider = new MockProvider({
      ideas: (req) => {
        const prompt = req.user;
        expect(prompt).toContain("STORIES");
        return {
          ideas: [
            { title: "The river deal nobody has read", hook: "Two governments signed a water deal without saying how much water.", angle: "What the missing volumes mean for farmers.", why_untold: "Only regional outlets covered it.", why_it_lands: "Water is daily life.", format: "youtube-long", angle_type: "mechanism", stories: ["T1"], sources: ["S1", "S99"], open_questions: ["What volumes were proposed?"], effort: "medium", timeliness: "timely" },
            { title: "Who won the Calder port contract?", hook: "A port concession went without a tender.", angle: "Follow the consortium's owners.", why_untold: "Little coverage.", why_it_lands: "Public money.", format: "short-video", angle_type: "follow-the-money", stories: ["T2", "T9"], sources: [], open_questions: [], effort: "low", timeliness: "timely" },
            { title: "Not allowed", hook: "x", angle: "x", why_untold: "x", why_it_lands: "x", format: "op-ed", angle_type: "explainer", stories: [], sources: [], open_questions: [], effort: "low", timeliness: "evergreen" },
          ],
        };
      },
      summary: () => ({ summary: "You favour follow-the-money short videos about South Asian infrastructure." }),
    });
    useMock(provider);
  });
  afterEach(() => useMock(null));

  it("finds untold opportunities locally with reasons", () => {
    const opps = findOpportunities(db, { limit: 10 });
    expect(opps.length).toBeGreaterThan(0);
    const amber = opps.find((o) => o.headline.includes("Amber"));
    expect(amber?.reasons.join(" ")).toMatch(/no international outlet/);
  });

  it("generates ideas backed by real stories, drops invented refs and disallowed formats", async () => {
    const est = await generateIdeas(db, { estimateOnly: true });
    expect(isEstimate(est)).toBe(true);
    expect(provider.calls).toHaveLength(0);

    const r = await generateIdeas(db, { formats: ["youtube-long", "short-video"] });
    expect(!isEstimate(r) && r.ok).toBe(true);
    const ideas = listIdeas(db, { status: "new" });
    expect(ideas.map((i) => i.title).sort()).toEqual(["The river deal nobody has read", "Who won the Calder port contract?"]);
    const river = ideas.find((i) => i.title.startsWith("The river"))!;
    expect(river.backing.clusters).toHaveLength(1);
    expect(river.backing.sources).toHaveLength(1); // S99 was invented and dropped
    // Only one fixture story qualifies as untold, so T2/T9 do not exist and are dropped.
    expect(ideas.find((i) => i.title.startsWith("Who won"))!.backing.clusters).toHaveLength(0);
    expect(river.medium).toBe("visual");
  });

  it("learns from swipes and develops an idea into a project", async () => {
    await generateIdeas(db, {});
    const all = listIdeas(db, { status: "new" });
    const a = all.find((i) => i.backing.clusters.length)!;
    const b = all.find((i) => i.id !== a.id)!;
    updateIdea(db, a.id, { status: "saved", reason: "Great untold angle" });
    recordTaste(db, { kind: "idea-save", objectType: "idea", objectId: a.id, format: a.format, angleType: a.angleType, tags: tagsOf(a.title), reason: "Great untold angle" });
    recordTaste(db, { kind: "idea-skip", objectType: "idea", objectId: b.id, format: b.format, angleType: b.angleType, tags: tagsOf(b.title), reason: "Too obvious" });
    const stats = tasteStats(db);
    expect(stats.formats.find((f) => f.id === a.format)?.liked).toBe(1);
    expect(stats.reasons.map((r) => r.reason)).toContain("Too obvious");

    const { projectId } = developIdea(db, a.id);
    expect(getIdea(db, a.id)?.status).toBe("developing");
    expect(projectItemIds(db, projectId, "cluster").length).toBeGreaterThan(0);
    expect(listQuestions(db, { projectId }).map((q) => q.text)).toContain(a.openQuestions[0]);
    expect(developIdea(db, a.id).projectId).toBe(projectId); // idempotent
  });

  it("summarises taste and feeds profile + taste into prompts", async () => {
    createInspiration(db, { url: null, kind: "text", title: "Ports and power in South Asia", author: null, description: null, thumbnail: null, note: "love follow-the-money", intents: ["cover-topic"], matchedClusters: [] });
    recordTaste(db, { kind: "idea-save", format: "short-video", angleType: "follow-the-money", tags: ["port"] });
    recordTaste(db, { kind: "idea-save", format: "short-video", angleType: "follow-the-money", tags: ["port"] });
    setSetting(db, "profile.about", "I make videos for a Bangladeshi audience.");
    const r = await updateTasteSummary(db);
    expect(!isEstimate(r) && r.ok).toBe(true);
    const ctx = personalContext(db);
    expect(ctx).toContain("Bangladeshi audience");
    expect(ctx).toContain("follow-the-money short videos");
  });
});
