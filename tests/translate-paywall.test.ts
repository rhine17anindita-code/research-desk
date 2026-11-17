import { describe, expect, it } from "vitest";
import { freshDb } from "./helpers";
import { getTranslation, isBangla, saveTranslation, splitParts, translationJobs } from "@/lib/translate";
import { freeAlternatives, isPaywalled } from "@/lib/ingest/fulltext";

describe("free Bangla → English", () => {
  it("spots Bangla text and splits long text into pieces", () => {
    expect(isBangla("ওয়াকারের হাতে ক্ষমতা চায় ইন্ডিয়া, তারেক দুধভাত || Pinaki Bhattacharya")).toBe(true);
    expect(isBangla("India wants power in Waker's hands")).toBe(false);
    expect(isBangla("BNP 2026")).toBe(false);
    const parts = splitParts("প্রথম বাক্য। ".repeat(80));
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= 420)).toBe(true);
  });

  it("queues Bangla episode titles for the Mac helper, then stops once translated", () => {
    const db = freshDb();
    const now = new Date().toISOString();
    db.prepare("INSERT INTO feeds (id, name, url, category, language, enabled, priority, created_at, updated_at) VALUES ('f1', 'Show', 'https://x.test/rss', 'talk', 'bn', 1, 0, ?, ?)").run(now, now);
    db.prepare("INSERT INTO articles (id, feed_id, url, canonical_url, title, publisher, published_at, fetched_at, title_hash, created_at) VALUES ('a1', 'f1', 'https://x.test/1', 'c1', 'তারেক রহমান দেশে ফিরছেন', 'Show', ?, ?, 'h1', ?)").run(now, now, now);
    db.prepare("INSERT INTO articles (id, feed_id, url, canonical_url, title, publisher, published_at, fetched_at, title_hash, created_at) VALUES ('a2', 'f1', 'https://x.test/2', 'c2', 'An English title', 'Show', ?, ?, 'h2', ?)").run(now, now, now);
    const jobs = translationJobs(db);
    expect(jobs.map((j) => j.id)).toEqual(["a1"]);
    saveTranslation(db, "article", "a1", ["Tarique Rahman is coming home"], "nllb");
    expect(getTranslation(db, "article", "a1")).toEqual(["Tarique Rahman is coming home"]);
    expect(translationJobs(db)).toHaveLength(0);
  });
});

describe("paywalled articles", () => {
  it("knows paywalled outlets and suggests free full-text coverage of the same story", () => {
    expect(isPaywalled("https://www.ft.com/content/abc")).toBe(true);
    expect(isPaywalled("https://www.economist.com/asia/2026/11/17/x")).toBe(true);
    expect(isPaywalled("https://www.dhakatribune.com/x")).toBe(false);
    const db = freshDb();
    const now = new Date().toISOString();
    db.prepare("INSERT INTO clusters (id, headline, first_seen_at, last_updated_at, article_count, source_count, created_at, updated_at) VALUES ('c1', 'Story', ?, ?, 2, 2, ?, ?)").run(now, now, now, now);
    const art = (id: string, url: string, status: string, pub: string) =>
      db.prepare("INSERT INTO articles (id, url, canonical_url, title, publisher, fetched_at, title_hash, created_at, cluster_id, text_status, full_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'c1', ?, ?)").run(id, url, url, `T ${id}`, pub, now, id, now, status, status === "full" ? "x".repeat(2000) : null);
    art("pw", "https://www.ft.com/content/abc", "paywalled", "FT");
    art("free1", "https://www.dhakatribune.com/a", "full", "Dhaka Tribune");
    art("free2", "https://www.aljazeera.com/b", "summary", "Al Jazeera");
    expect(freeAlternatives(db, "pw").map((a) => a.id)).toEqual(["free1"]);
  });
});
