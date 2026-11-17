import { afterEach, describe, expect, it, vi } from "vitest";
import { freshDb } from "./helpers";
import { runCloudJobs, supadataTranscript, supadataUsage, transcriptServiceReady } from "@/lib/cloud-jobs";
import { setSecret } from "@/lib/secrets";
import { cachedTranscript, queueTranscript } from "@/lib/transcripts";
import { setSetting } from "@/lib/repo/settings";

afterEach(() => vi.unstubAllGlobals());

describe("server-side jobs (no laptop needed)", () => {
  it("does nothing paid without a transcript key", async () => {
    const db = freshDb();
    expect(transcriptServiceReady(db)).toBe(false);
    await expect(supadataTranscript(db, "https://youtu.be/x")).rejects.toThrow(/No transcript service/);
  });

  it("fetches queued transcripts through the service and counts usage within the cap", async () => {
    const db = freshDb();
    setSecret(db, "SUPADATA_API_KEY", "test_key_1234567890abcd");
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (u: string, init?: RequestInit) => {
      calls.push(String(u));
      if (String(u).includes("supadata")) {
        expect((init?.headers as Record<string, string>)["x-api-key"]).toBe("test_key_1234567890abcd");
        return new Response(JSON.stringify({ lang: "bn", content: [{ text: "আমরা", offset: 0, duration: 1000 }, { text: "দেখছি", offset: 1000, duration: 900 }] }), { status: 200 });
      }
      return new Response("{}", { status: 500 });
    });
    queueTranscript(db, "abcdefghijk", null);
    await runCloudJobs(db);
    const t = cachedTranscript(db, "abcdefghijk")!;
    expect(t.status).toBe("ok");
    expect(t.segments.map((s) => s.text).join(" ")).toBe("আমরা দেখছি");
    expect(calls.some((c) => c.includes("mode=native"))).toBe(true);
    expect(supadataUsage(db).n).toBe(1);
    setSetting(db, "transcripts.monthly_cap", 1);
    expect(transcriptServiceReady(db)).toBe(false);
  });
});
