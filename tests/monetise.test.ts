import { describe, expect, it } from "vitest";
import { freshDb } from "./helpers";
import { addEntry, brandSafety, buildProposal, deleteEntry, getMonSettings, listItems, listSeries, listSponsors, planFor, rateCard, saveProposal, topicsOf, updateEntry, updateMonSettings } from "@/lib/monetise";
import { PLAYS, SERIES, SPONSORS } from "@/lib/monetise/library";
import { createProject } from "@/lib/repo/projects";
import { updateProduction } from "@/lib/production";
import { upsertPost } from "@/lib/performance/store";
import { getProfile, styleBlock } from "@/lib/voice";

describe("monetisation library", () => {
  it("seeds an editable copy once per channel, and edits/deletes stick", () => {
    const db = freshDb();
    expect(listItems(db)).toHaveLength(PLAYS.length);
    expect(listSponsors(db)).toHaveLength(SPONSORS.length);
    expect(listSeries(db)).toHaveLength(SERIES.length);
    const first = listItems(db)[0];
    updateEntry(db, "item", first.id, { starred: true, title: "My edit" });
    expect(listItems(db).find((i) => i.id === first.id)).toMatchObject({ starred: true, title: "My edit" });
    const mine = addEntry(db, "item", { kind: "cta", title: "My own CTA", how: "x", formats: ["short"], goals: ["grow"] });
    expect(listItems(db).some((i) => i.id === mine && i.source === "mine")).toBe(true);
    deleteEntry(db, "item", mine);
    expect(listItems(db).some((i) => i.id === mine)).toBe(false);
    expect(listItems(db)).toHaveLength(PLAYS.length); // not re-seeded
  });

  it("reads topics and brand safety from the words", () => {
    expect(topicsOf("Why rice prices jumped and what it costs you in taka")).toEqual(expect.arrayContaining(["money", "food"]));
    expect(brandSafety(topicsOf("The muslin myth: the real history of Dhaka's fabric")).level).toBe("brand-safe");
    expect(brandSafety(topicsOf("BNP and Awami League clash; three killed in violence")).level).toBe("sensitive");
  });
});

describe("plans, rates and proposals", () => {
  it("suggests sponsors and integrations for a brand-safe Short, and none for a sensitive one", () => {
    const db = freshDb();
    const safe = createProject(db, { title: "Where does your remittance fee go? Money explained" });
    updateProduction(db, safe.id, { contentType: "short" });
    const plan = planFor(db, safe.id)!;
    expect(plan.safety.level).toBe("brand-safe");
    expect(plan.categories.map((c) => c.id)).toContain("mfs");
    expect(plan.sponsors.some((s) => s.name === "bKash")).toBe(true);
    expect(plan.integrations.every((i) => i.formats.includes("short") || i.formats.includes("any"))).toBe(true);
    expect(plan.growth.length).toBeGreaterThan(0);

    const hot = createProject(db, { title: "Election violence: BNP and Awami League clash, many killed" });
    const p2 = planFor(db, hot.id)!;
    expect(p2.safety.level).toBe("sensitive");
    expect(p2.price).toBeNull();
    expect(p2.categories.every((c) => c.id === "csr")).toBe(true);
  });

  it("works out a rate card from real numbers and writes a full proposal", () => {
    const db = freshDb();
    const old = new Date(Date.now() - 10 * 86_400_000).toISOString();
    for (let i = 0; i < 8; i++) upsertPost(db, { platform: "instagram", postId: `p${i}`, url: null, title: `Reel ${i}`, kind: "reel", publishedAt: old, durationS: null, views: 50000, reach: null, likes: 10, comments: 1, shares: null, saves: null, follows: null, thumbnail: null, source: "csv" });
    const card = rateCard(db);
    const short = card.lines[0];
    expect(short.low).toBe(20000); // 50,000 views × ৳400 per 1,000
    expect(short.high).toBe(45000);
    updateMonSettings(db, { contactName: "Anindita", contactEmail: "biz@example.com" });
    expect(getMonSettings(db).contactName).toBe("Anindita");
    const sp = listSponsors(db).find((s) => s.name === "bKash")!;
    const se = listSeries(db).find((s) => s.name === "Money Minutes")!;
    const prop = buildProposal(db, { sponsorId: sp.id, seriesId: se.id, deliverables: [{ label: short.deliverable, count: 4, low: short.low, high: short.high }] });
    expect(prop.title).toContain("Money Minutes × bKash");
    expect(prop.body).toContain("Editorial independence");
    expect(prop.body).toContain("৳80,000");
    expect(prop.low).toBe(80000);
    const saved = saveProposal(db, { sponsorId: sp.id, deliverables: [{ label: "x", count: 1, low: 1000, high: 2000 }] });
    expect(saved.status).toBe("draft");
  });
});

describe("per-project dials", () => {
  it("override the channel's dials for that script only", () => {
    const db = freshDb();
    const p = getProfile(db);
    expect(styleBlock(db, { dials: { ...p.dials, humour: 95 } })).toContain("strongly lots of humour");
    expect(styleBlock(db)).not.toContain("strongly lots of humour");
  });
});
