import { describe, expect, it } from "vitest";
import { clusterBatch, type ArticleFingerprint } from "@/lib/ingest/cluster";
import { extractEntities, uniqueTokens } from "@/lib/text";

const fp = (title: string, summary = "", hoursAgo = 0): ArticleFingerprint => ({
  titleTokens: new Set(uniqueTokens(title)),
  allTokens: new Set(uniqueTokens(`${title} ${summary}`)),
  entities: new Set(extractEntities(`${title}. ${summary}`)),
  publishedAt: Date.now() - hoursAgo * 3_600_000,
});

describe("story clustering", () => {
  it("groups differently worded coverage of the same event", () => {
    const a = clusterBatch([
      fp("Trump, Putin and Xi to hold first three-way meeting in China"),
      fp("Xi, Putin and Trump to meet in China for first trilateral summit"),
      fp("Robert Pattinson named the next James Bond"),
      fp("Pattinson will be the next James Bond, producers confirm"),
      fp("Floods displace thousands in northern Kenya"),
    ]);
    expect(a[0]).toBe(a[1]);
    expect(a[2]).toBe(a[3]);
    expect(a[0]).not.toBe(a[2]);
    expect(new Set(a).size).toBe(3);
  });

  it("does not merge unrelated stories that share a single common word", () => {
    const a = clusterBatch([fp("Bank of England holds rates"), fp("World Bank approves Kenya loan")]);
    expect(a[0]).not.toBe(a[1]);
  });

  it("does not merge across a long time gap", () => {
    const a = clusterBatch([fp("Volcano erupts on Iceland peninsula", "", 0), fp("Volcano erupts on Iceland peninsula", "", 200)]);
    expect(a[0]).not.toBe(a[1]);
  });
});
