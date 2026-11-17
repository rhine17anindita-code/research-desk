import { afterEach, describe, expect, it, vi } from "vitest";
import { freshDb } from "./helpers";
import { signHelper, verifyHelper } from "@/lib/helper-auth";
import { cachedTranscript, queueTranscript, transcriptFor } from "@/lib/transcripts";
import { getSetting } from "@/lib/repo/settings";
import { setTalkShow, talkShows } from "@/lib/ideation/talk";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.YOUTUBE_API_KEY;
});

const req = (path: string, headers: Record<string, string>) => new Request(`https://site.test${path}`, { headers });

describe("phase A: the Mac helper", () => {
  it("accepts only requests signed with the shared key, and only recent ones", () => {
    process.env.YOUTUBE_API_KEY = "shared-key";
    const ts = String(Date.now());
    expect(verifyHelper(req("/api/helper/jobs", { "x-helper-ts": ts, "x-helper-sig": signHelper("shared-key", ts, "/api/helper/jobs") }))).toBe(true);
    expect(verifyHelper(req("/api/helper/jobs", { "x-helper-ts": ts, "x-helper-sig": signHelper("wrong", ts, "/api/helper/jobs") }))).toBe(false);
    expect(verifyHelper(req("/api/helper/transcript", { "x-helper-ts": ts, "x-helper-sig": signHelper("shared-key", ts, "/api/helper/jobs") }))).toBe(false);
    const old = String(Date.now() - 10 * 60_000);
    expect(verifyHelper(req("/api/helper/jobs", { "x-helper-ts": old, "x-helper-sig": signHelper("shared-key", old, "/api/helper/jobs") }))).toBe(false);
    expect(verifyHelper(req("/api/helper/jobs", {}))).toBe(false);
  });

  it("queues a transcript for the helper instead of showing YouTube's 'not a bot' message", async () => {
    const db = freshDb();
    db.prepare("INSERT INTO feeds (id, name, url, category, enabled, priority, created_at, updated_at) VALUES ('f1', 'Show', 'https://x.test/rss', 'talk', 1, 0, datetime('now'), datetime('now'))").run();
    db.prepare(
      "INSERT INTO articles (id, feed_id, url, canonical_url, title, publisher, fetched_at, title_hash, created_at) VALUES ('a1', 'f1', 'https://www.youtube.com/watch?v=abcdefghijk', 'c1', 'Ep', 'Show', datetime('now'), 'h', datetime('now'))",
    ).run();
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ playabilityStatus: { status: "LOGIN_REQUIRED", reason: "Sign in to confirm you’re not a bot" } }), { status: 200 }));
    const t = await transcriptFor(db, "a1");
    expect(t?.status).toBe("queued");
    expect(t?.error).toBeNull();
    expect(getSetting(db, "transcripts.blocked_at")).not.toBe("");
    // Once blocked, the server stops asking YouTube and just queues.
    queueTranscript(db, "zzzzzzzzzzz", null);
    expect(cachedTranscript(db, "zzzzzzzzzzz")?.status).toBe("queued");
  });
});

describe("phase A: talk shows per channel", () => {
  it("switches shows on and off for the active channel", () => {
    const db = freshDb();
    db.prepare("INSERT INTO feeds (id, name, url, category, enabled, priority, created_at, updated_at) VALUES ('t1', 'A Show', 'https://x.test/a', 'talk', 1, 0, datetime('now'), datetime('now'))").run();
    expect(talkShows(db)[0].on).toBe(true);
    setTalkShow(db, "t1", false);
    expect(talkShows(db)[0].on).toBe(false);
    setTalkShow(db, "t1", true);
    expect(talkShows(db)[0].on).toBe(true);
  });
});
