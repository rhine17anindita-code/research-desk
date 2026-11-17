import { describe, expect, it } from "vitest";
import { freshDb } from "./helpers";
import { clock, findMoments, parseClock, scoreWindow, textAround, transcriptText, windows, type Transcript } from "@/lib/transcripts";
import { liveStatus } from "@/lib/live";
import { addResearch, articleText, getResearch, listResearch, updateResearch, deleteResearch } from "@/lib/research-inbox";
import { termMatcher } from "@/lib/channels";
import { modelForTask } from "@/lib/ai/task-models";

const seg = (t: number, text: string) => ({ t, d: 4, text });
const tr = (segments: ReturnType<typeof seg>[]): Transcript => ({
  videoId: "abcdefghijk", articleId: null, language: "en", kind: "asr", segments, chars: 0, status: "ok", error: null, mined: null, minedAt: null, fetchedAt: new Date().toISOString(),
});

describe("transcripts: free moment finder", () => {
  it("formats and parses time marks", () => {
    expect(clock(75)).toBe("1:15");
    expect(clock(3725)).toBe("1:02:05");
    expect(parseClock("1:02:05")).toBe(3725);
    expect(parseClock("x")).toBeNull();
  });

  it("splits into ~75s windows and scores Bangladesh, numbers and 'real story' talk above chit-chat", () => {
    const segs = [];
    for (let i = 0; i < 60; i++) segs.push(seg(i * 5, i >= 30 && i < 40 ? "The truth is the Bangladesh deal was worth 3 billion dollars and nobody is talking about it" : "yeah that's funny man we had a great time"));
    const t = tr(segs);
    const ws = windows(t.segments);
    expect(ws.length).toBeGreaterThan(2);
    const none = termMatcher([]);
    expect(scoreWindow("The truth is the Bangladesh deal was 3 billion dollars", none, none).score).toBeGreaterThan(scoreWindow("yeah that's funny", none, none).score);
    expect(scoreWindow("This video is sponsored by NordVPN, use code X", none, none).score).toBeLessThan(0);
    const db = freshDb();
    const ms = findMoments(db, t, 3);
    expect(ms.length).toBeGreaterThan(0);
    expect(ms[0].start).toBeGreaterThanOrEqual(140);
    expect(ms[0].url).toContain("&t=");
    expect(textAround(t, ms[0].start)).toContain("Bangladesh");
  });

  it("caps long transcripts by keeping the strongest parts, in order", () => {
    const segs = [];
    for (let i = 0; i < 2000; i++) segs.push(seg(i * 5, i % 97 === 0 ? "Bangladesh election rigged 40 percent secret deal" : "just talking about nothing in particular for a while here"));
    const db = freshDb();
    const { text, partial } = transcriptText(db, tr(segs), 8000);
    expect(partial).toBe(true);
    expect(text.length).toBeLessThanOrEqual(9000);
    expect(text).toContain("Bangladesh election");
    expect(text).toContain("[…]");
  });
});

describe("live status", () => {
  it("works on an empty database and counts new stories since a time", () => {
    const db = freshDb();
    const s = liveStatus(db, null);
    expect(s.newStories).toBe(0);
    expect(s.spiking).toEqual([]);
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO clusters (id, headline, first_seen_at, last_updated_at, source_count, article_count, created_at, updated_at, regions) VALUES ('c1', 'Bangladesh central bank raises rates again', ?, ?, 7, 7, ?, ?, '["Bangladesh"]')`,
    ).run(now, now, now, now);
    const s2 = liveStatus(db, new Date(Date.now() - 60_000).toISOString());
    expect(s2.newStories).toBe(1);
    expect(s2.fresh[0]?.id).toBe("c1");
    expect(s2.spiking[0]?.id).toBe("c1");
  });
});

describe("my research inbox", () => {
  it("extracts article paragraphs and drops navigation", () => {
    const html = `<nav><p>Home News Sport Weather and lots of other menu links here</p></nav><article><h1>T</h1><p>The Padma bridge toll has collected more than expected in its third year, officials said on Monday.</p><p>Short</p><p>Critics say the figures leave out the cost of the loans that paid for it, which run for decades.</p></article>`;
    const t = articleText(html);
    expect(t).toContain("Padma bridge");
    expect(t).toContain("Critics say");
    expect(t).not.toContain("Home News");
  });

  it("adds pasted text and notes as sources, edits and removes them — without AI", async () => {
    const db = freshDb();
    const a = await addResearch(db, { text: "Bangladesh's garment exports fell 8% in October.\nThe industry blames gas shortages.", note: "Could be a Short" });
    expect(a.kind).toBe("text");
    expect(a.title).toContain("garment exports");
    expect(a.sourceId).toBeTruthy();
    const n = await addResearch(db, { note: "Saw on Somoy TV 9pm: new metro line opening delayed again" });
    expect(n.kind).toBe("note");
    expect(listResearch(db)).toHaveLength(2);
    const u = updateResearch(db, a.id, { body: "x".repeat(500) })!;
    expect(u.status).toBe("ready");
    expect((db.prepare("SELECT excerpt FROM sources WHERE id = ?").get(a.sourceId) as { excerpt: string }).excerpt).toHaveLength(500);
    deleteResearch(db, n.id);
    expect(getResearch(db, n.id)).toBeNull();
    await expect(addResearch(db, {})).rejects.toThrow();
    await expect(addResearch(db, { url: "http://localhost/admin" })).rejects.toThrow();
  });

  it("saves screenshots/PDFs for reading, and rejects other files", async () => {
    const db = freshDb();
    const f = await addResearch(db, { file: { name: "notice.png", type: "image/png", data: Buffer.from([137, 80, 78, 71]) } });
    expect(f.status).toBe("needs_read");
    deleteResearch(db, f.id);
    await expect(addResearch(db, { file: { name: "x.exe", type: "application/octet-stream", data: Buffer.from([1]) } })).rejects.toThrow();
  });

  it("routes the new AI jobs to the right models", () => {
    expect(modelForTask("talk.mine", {}, "x")).toBe("claude-sonnet-5-5");
    expect(modelForTask("research.read", {}, "x")).toBe("claude-haiku-5-5");
  });
});
