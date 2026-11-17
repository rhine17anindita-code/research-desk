import { describe, expect, it } from "vitest";
import { freshDb } from "./helpers";
import { importCsv, parseCsv, parseDate } from "@/lib/performance/csv-import";
import { listDaily, listPosts, upsertPost } from "@/lib/performance/store";
import { commentScan, performance, performanceBrief } from "@/lib/performance/patterns";
import { modelForTask } from "@/lib/ai/task-models";

const IG = `﻿Post ID,Account ID,Account username,Account name,Description,Duration (sec),Publish time,Permalink,Post type,Data comment,Date,Views,Reach,Likes,Shares,Follows,Comments,Saves
"18001","17841","anindita.rhine","Anindita","Why is Dhaka sinking? ""A thread""",62,11/02/2026 18:30,https://www.instagram.com/reel/AbC123/,IG reel,,Lifetime,"12,400",9100,820,140,12,33,210
"18002","17841","anindita.rhine","Anindita","Bangladesh vs India water deal",45,10/28/2026 09:05,https://www.instagram.com/reel/DeF456/,IG reel,,Lifetime,3100,2500,150,9,1,8,20
"18003","17841","anindita.rhine","Anindita","Photo dump from the rally",,10/20/2026 21:00,https://www.instagram.com/p/GhI789/,IG carousel,,Lifetime,,1500,90,2,0,4,3`;

const FB = `Post ID,Page ID,Page name,Title,Description,Duration (sec),Publish time,Permalink,Post type,Date,Impressions,Reach,Reactions,Comments,Shares,Views
1001,55,Anindita Rhine,,Who really owns Bangladesh's garment factories?,70,11/01/2026 20:00,https://www.facebook.com/reel/1001,Videos,Lifetime,30000,20000,400,50,60,15000`;

const TT_DAILY = `Date,Video Views,Profile Views,Likes,Comments,Shares
2026-11-01,1200,40,300,12,5
2026-11-02,900,31,210,7,2`;

describe("phase 3: importing stats exports", () => {
  it("parses quoted CSV with BOM, commas and doubled quotes", () => {
    const rows = parseCsv('a,b\n"x, y","say ""hi"""\n');
    expect(rows).toEqual([["a", "b"], ["x, y", 'say "hi"']]);
    expect(parseDate("11/02/2026 18:30")).toBe("2026-11-02T18:30:00.000Z");
    expect(parseDate("10/20/2026 9:05 pm")).toBe("2026-10-20T21:05:00.000Z");
    expect(parseDate("nonsense")).toBeNull();
  });

  it("imports an Instagram export, and re-importing updates rather than duplicates", () => {
    const db = freshDb();
    const r = importCsv(db, IG);
    expect(r.kind).toBe("posts");
    expect(r.platforms).toEqual({ instagram: 3 });
    const posts = listPosts(db, { platform: "instagram" });
    expect(posts).toHaveLength(3);
    const reel = posts.find((p) => p.postId === "18001")!;
    expect(reel.views).toBe(12400);
    expect(reel.saves).toBe(210);
    expect(reel.kind).toBe("reel");
    expect(reel.title).toBe('Why is Dhaka sinking? "A thread"');
    expect(posts.find((p) => p.postId === "18003")!.kind).toBe("carousel");
    importCsv(db, IG.replace('"12,400"', '"15,000"'));
    expect(listPosts(db, { platform: "instagram" })).toHaveLength(3);
    expect(listPosts(db, { platform: "instagram" }).find((p) => p.postId === "18001")!.views).toBe(15000);
  });

  it("prefers a real Views column over Impressions, and takes the description when there's no title", () => {
    const db = freshDb();
    importCsv(db, FB);
    const p = listPosts(db, { platform: "facebook" })[0];
    expect(p.views).toBe(15000);
    expect(p.likes).toBe(400);
    expect(p.title).toContain("garment factories");
    expect(p.kind).toBe("reel");
  });

  it("imports daily totals (e.g. TikTok overview) when there are no posts", () => {
    const db = freshDb();
    const r = importCsv(db, TT_DAILY, "tiktok");
    expect(r.kind).toBe("daily");
    expect(listDaily(db, "tiktok", 5000)).toHaveLength(2);
    expect(() => importCsv(db, "a,b\n1,2")).toThrow();
  });
});

describe("phase 3: what works", () => {
  it("compares posts with the platform's typical post and finds patterns", () => {
    const db = freshDb();
    const old = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
    const base = { platform: "youtube" as const, url: null, reach: null, likes: 10, comments: 1, shares: null, saves: null, follows: null, thumbnail: null, source: "api" as const, kind: "short", durationS: 50 };
    for (let i = 0; i < 10; i++) upsertPost(db, { ...base, postId: `q${i}`, title: i < 4 ? `Why is Bangladesh broke? part ${i}` : `Weekly update ${i}`, publishedAt: old(10 + i), views: i < 4 ? 5000 : 1000 });
    const perf = performance(db);
    expect(perf.summaries[0].typical).toBe(1000);
    expect(perf.top[0].lift).toBe(5);
    expect(perf.patterns.some((p) => p.label === "A question in the title" && p.lift > 1)).toBe(true);
    expect(performanceBrief(db, perf)).toContain("YouTube");
    expect(performanceBrief(freshDb())).toBe("");
    expect(commentScan(db).count).toBe(0);
  });

  it("routes strategist and comment jobs to the right models", () => {
    expect(modelForTask("strategy.report", {}, "x")).toBe("claude-opus-5-5");
    expect(modelForTask("audience.comments", {}, "x")).toBe("claude-sonnet-5-5");
  });
});
