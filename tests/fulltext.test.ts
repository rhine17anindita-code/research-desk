import { afterEach, describe, expect, it, vi } from "vitest";
import { freshDb } from "./helpers";
import { fetchFullText, saveHelperPage } from "@/lib/ingest/fulltext";
import { sourceForArticle } from "@/lib/repo/sources";

afterEach(() => vi.unstubAllGlobals());

const para = "The central bank said on Monday that the new policy would take effect next month, after weeks of talks with lenders and the finance ministry about liquidity. ";
const ARTICLE = `<html><body><nav><p>Home News Sport and many other links in the menu here</p></nav><article>${Array.from({ length: 12 }, (_, i) => `<p>Paragraph ${i + 1}: ${para}</p>`).join("")}</article></body></html>`;

function seed() {
  const db = freshDb();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO clusters (id, headline, first_seen_at, last_updated_at, article_count, source_count, created_at, updated_at) VALUES ('c1', 'Bank policy', ?, ?, 3, 3, ?, ?)`).run(now, now, now, now);
  const art = (id: string, url: string, title: string) =>
    db.prepare(`INSERT INTO articles (id, url, canonical_url, title, publisher, fetched_at, title_hash, created_at, cluster_id) VALUES (?, ?, ?, ?, 'X', ?, ?, ?, 'c1')`).run(id, url, url, title, now, id, now);
  art("direct", "https://outlet.test/bank-policy", "Bangladesh Bank announces new policy rate");
  art("gn", "https://news.google.com/rss/articles/ABC?oc=5", "Bangladesh Bank announces new policy rate - The Outlet");
  art("blocked", "https://paywall.test/story", "Another take on the bank policy");
  return db;
}

describe("full articles after refresh", () => {
  it("reads the outlet's page, uses it for Google News twins, and hands refused sites to the Mac helper", async () => {
    const db = seed();
    vi.stubGlobal("fetch", async (u: string | URL) => (String(u).includes("paywall") ? new Response("no", { status: 403 }) : new Response(ARTICLE, { status: 200 })));
    const r = await fetchFullText(db, 10);
    expect(r.full).toBeGreaterThanOrEqual(1);
    expect(r.blocked).toBe(1);
    const get = (id: string) => db.prepare("SELECT text_status, direct_url, length(full_text) AS n FROM articles WHERE id = ?").get(id) as { text_status: string; direct_url: string | null; n: number | null };
    expect(get("direct").text_status).toBe("full");
    expect(get("blocked").text_status).toBe("blocked");
    // The Google News copy borrows the direct article's link and text (now or on the next pass).
    await fetchFullText(db, 10);
    expect(get("gn").direct_url).toBe("https://outlet.test/bank-policy");
    expect(get("gn").text_status).toBe("full");
    // Sources built from these articles carry the full text and clean link.
    const s = sourceForArticle(db, "gn")!;
    expect(s.url).toContain("outlet.test");
    expect((s.excerpt ?? "").length).toBeGreaterThan(1200);
    // The helper's copy of the refused page fills it in.
    saveHelperPage(db, "blocked", ARTICLE);
    expect(get("blocked").text_status).toBe("full");
  });
});
