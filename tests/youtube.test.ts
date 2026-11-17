import { afterEach, describe, expect, it, vi } from "vitest";
import { freshDb } from "./helpers";
import { addCompetitor, breakouts, buildDescription, checkTitle, checks, diagnose, listYtChannels, saveYtChannel, setCheck, setProjectYoutube, weeklyPlan, yppProgress } from "@/lib/youtube";
import { FORMATS, LAUNCH, SET_GUIDE, WORKFLOW } from "@/lib/youtube/guide";
import { createProject } from "@/lib/repo/projects";
import { updateProduction } from "@/lib/production";
import { upsertDaily, upsertPost } from "@/lib/performance/store";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.YOUTUBE_API_KEY;
});

describe("YouTube studio", () => {
  it("starts with your channels, main channel first, and saves edits", () => {
    const db = freshDb();
    const chs = listYtChannels(db);
    expect(chs[0]).toMatchObject({ name: "Anindita Rhine", status: "active", deskChannelId: "ch_default" });
    expect(chs.map((c) => c.name)).toEqual(expect.arrayContaining(["Rhine Reviews", "History (working title)", "Money (working title)", "Geopolitics (working title)"]));
    const s = saveYtChannel(db, chs[0].id, { watchHours: 120, pillars: ["A", "B"] });
    expect(s.watchHours).toBe(120);
    expect(s.pillars).toEqual(["A", "B"]);
  });

  it("measures progress to monetisation from your own numbers", () => {
    const db = freshDb();
    const main = listYtChannels(db)[0];
    upsertDaily(db, { platform: "youtube", date: "2026-11-17", followers: 308 }, "ch_default");
    upsertPost(db, { platform: "youtube", postId: "s1", url: null, title: "x", kind: "short", publishedAt: new Date().toISOString(), durationS: 50, views: 3000, reach: null, likes: 1, comments: 0, shares: null, saves: null, follows: null, thumbnail: null, source: "api" }, "ch_default");
    const p = yppProgress(db, main);
    expect(p.subscribers).toBe(308);
    expect(p.shortsViews90d).toBe(3000);
    expect(p.longVideos).toBe(0);
  });

  it("plans a solo week that adds up, with long-form first", () => {
    const w = weeklyPlan(20);
    const total = w.blocks.reduce((n, b) => n + b.hours, 0);
    expect(total).toBeGreaterThanOrEqual(19);
    expect(total).toBeLessThanOrEqual(21);
    expect(w.rules.join(" ")).toMatch(/Shorts don't count/);
  });

  it("checks titles and diagnoses the 48-hour numbers", () => {
    expect(checkTitle("Why India can still say no to sending Hasina back").score).toBeGreaterThanOrEqual(80);
    expect(checkTitle("SHOCKING!!! YOU WON'T BELIEVE THIS").score).toBeLessThan(50);
    const d = diagnose({ ctr: 2.1, avdSeconds: 120, lengthSeconds: 600, first30: 55 });
    expect(d.map((x) => x.status)).toEqual(["fix", "fix", "fix"]);
  });

  it("builds a description with chapters timed from the script and its sources", () => {
    const db = freshDb();
    const pr = createProject(db, { title: "Teesta deal explained" });
    const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");
    updateProduction(db, pr.id, { docs: { script: `# T\n\n## Hook\nWhy is the Teesta deal stuck? ${words(20)}\n\n## The history\n${words(300)} [1]\n\n## What it means\n${words(150)}\n\n## Sources\n1. Daily Star https://x.test` } });
    const yt = listYtChannels(db)[0];
    setProjectYoutube(db, pr.id, { ytChannelId: yt.id, format: "desk-explainer" });
    const desc = buildDescription(db, pr.id)!;
    expect(desc).toContain("0:00 Hook");
    expect(desc).toMatch(/0:\d\d The history/);
    expect(desc).toMatch(/2:\d\d What it means/);
    expect(desc).toContain("1. Daily Star");
    expect(desc).toContain("youtube.com/@aninditarhine");
  });

  it("remembers ticked checklists", () => {
    const db = freshDb();
    setCheck(db, "set", "li-key", true);
    setCheck(db, "launch:x", "verify", true);
    expect(checks(db, "set")).toEqual(["li-key"]);
    setCheck(db, "set", "li-key", false);
    expect(checks(db, "set")).toEqual([]);
  });

  it("tracks competitors and finds their breakout videos", async () => {
    process.env.YOUTUBE_API_KEY = "k";
    const views = [1000, 1200, 900, 1100, 5000];
    vi.stubGlobal("fetch", async (u: string | URL) => {
      const url = String(u);
      if (url.includes("/channels?")) return new Response(JSON.stringify({ items: [{ snippet: { title: "Rival Explains" } }] }));
      if (url.includes("/playlistItems?")) return new Response(JSON.stringify({ items: views.map((_, i) => ({ snippet: { title: `Video ${i}`, publishedAt: "2026-11-01T00:00:00Z", resourceId: { videoId: `vid${String(i).padStart(8, "0")}` } } })) }));
      if (url.includes("/videos?")) return new Response(JSON.stringify({ items: views.map((v, i) => ({ id: `vid${String(i).padStart(8, "0")}`, statistics: { viewCount: String(v), likeCount: "1", commentCount: "1" }, contentDetails: { duration: "PT10M" } })) }));
      return new Response("{}");
    });
    const db = freshDb();
    const yt = listYtChannels(db)[0];
    const c = await addCompetitor(db, yt.id, "UCabcdefghijklmnopqrstuv");
    expect(c).toMatchObject({ name: "Rival Explains", videos: 5, median: 1100 });
    const b = breakouts(db, yt.id);
    expect(b).toHaveLength(1);
    expect(b[0].title).toBe("Video 4");
    expect(b[0].multiple).toBeCloseTo(5000 / 1100, 1);
  });

  it("has a complete playbook", () => {
    expect(FORMATS.length).toBeGreaterThanOrEqual(12);
    expect(FORMATS.every((f) => f.structure.length >= 3 && f.hours > 0)).toBe(true);
    expect(SET_GUIDE.flatMap((s) => s.checks).some((c) => /25 fps/.test(c.text))).toBe(true);
    expect(WORKFLOW).toHaveLength(8);
    expect(LAUNCH.length).toBeGreaterThan(10);
  });
});
