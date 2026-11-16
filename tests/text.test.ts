import { describe, expect, it } from "vitest";
import { canonicalUrl, extractEntities, ftsQuery, jaccard, stripHtml, titleHash, tokenize } from "@/lib/text";

describe("text utilities", () => {
  it("canonicalises URLs for deduplication", () => {
    expect(canonicalUrl("http://www.Example.com/a/b/?utm_source=x&id=2#frag")).toBe("https://example.com/a/b?id=2");
    expect(canonicalUrl("https://example.com/a/b/amp/")).toBe("https://example.com/a/b");
    expect(canonicalUrl("not a url")).toBe("not a url");
  });

  it("hashes headlines independent of punctuation and case", () => {
    expect(titleHash("Rates held, bank says")).toBe(titleHash("rates held — BANK says!"));
  });

  it("tokenises without stopwords and with light stemming", () => {
    expect(tokenize("The banks announced new policies")).toEqual(["bank", "announced", "policy"]);
  });

  it("strips HTML and decodes entities", () => {
    expect(stripHtml("<p>A &amp; B&#8217;s <b>plan</b></p>")).toBe("A & B's plan");
    expect(stripHtml({ _: "object text" })).toBe("object text");
  });

  it("extracts multi-word entities but not sentence starters", () => {
    const e = extractEntities("Officials in Dhaka said the Asian Development Bank would fund it. Talks continue with the IMF.");
    expect(e).toContain("Asian Development Bank");
    expect(e).toContain("IMF");
    expect(e).not.toContain("Officials");
  });

  it("builds safe FTS queries", () => {
    expect(ftsQuery('river "deal" OR drop', "all")).toBe('"river"* AND "deal"* AND "OR"* AND "drop"*');
    expect(ftsQuery("!!", "all")).toBeNull();
  });

  it("computes jaccard similarity", () => {
    expect(jaccard(["a", "b"], ["b", "c"])).toBeCloseTo(1 / 3);
    expect(jaccard([], ["a"])).toBe(0);
  });
});
