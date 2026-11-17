import { afterEach, describe, expect, it, vi } from "vitest";
import { freshDb, MockProvider, useMock } from "./helpers";
import { listYtChannels } from "@/lib/youtube";
import { getBrief, ideaFeed, prompterText, recordingPack, startProduction, stepStatus, writeBrief, writeDossier, productionDirection } from "@/lib/youtube/producer";
import { guessFormat, PLAYBOOK } from "@/lib/youtube/strategy";
import { getProduction } from "@/lib/production";
import { packageContent, writeOutline, writeScript } from "@/lib/production-ai";

afterEach(() => {
  useMock(null);
  vi.unstubAllGlobals();
});

const SCRIPT = `# Why the Teesta deal is stuck

## Hook
If India and China both want the Teesta, who does Bangladesh choose? [1]
▸ Map of the Teesta basin

## The history
In 2011 the deal nearly happened. [CHECK: exact date] [2]

## Sources
1. A — B https://x.test`;

describe("YouTube producer", () => {
  it("picks a format from the topic", () => {
    expect(guessFormat("I read the budget document")).toBe("doc-breakdown");
    expect(guessFormat("Why the Teesta river matters to India and China")).toBe("map-explainer");
    expect(guessFormat("Why the taka keeps falling")).toBe("money-explainer");
    expect(guessFormat("The myth about muslin")).toBe("history-story");
    expect(PLAYBOOK).toMatch(/HOOK/);
  });

  it("gives the teleprompter only the words to say", () => {
    const p = prompterText(SCRIPT);
    expect(p.map((s) => s.section)).toEqual(["Hook", "The history"]);
    expect(p[0].lines[0]).toBe("If India and China both want the Teesta, who does Bangladesh choose?");
    expect(p[1].lines[0]).toBe("In 2011 the deal nearly happened.");
    expect(JSON.stringify(p)).not.toMatch(/▸|Sources|\[1\]|CHECK/);
  });

  it("runs the whole chain: brief → research → outline → script → package, then a recording pack", async () => {
    vi.stubGlobal("fetch", async () => new Response("[\"q\", []]", { status: 200 }));
    const db = freshDb();
    const yt = listYtChannels(db)[0];
    const id = startProduction(db, { ytChannelId: yt.id, title: "Your angle on: Why the Teesta deal is stuck", notes: "India vs China" });
    let p = getProduction(db, id)!;
    expect(p.title).toBe("Why the Teesta deal is stuck");
    expect(p.docs.yt_channel).toBe(yt.id);
    expect(p.docs.yt_format).toBe("map-explainer");
    expect(p.platforms).toEqual(["youtube"]);

    const mock = new MockProvider({
      angle: () => ({
        angle: "Bangladesh is the swing vote", viewer: "Young Bangladeshis", promise: "Know who controls the Teesta", why_now: "Talks restart", why_it_works: "Map videos break out for competitors",
        titles: Array.from({ length: 10 }, (_, i) => ({ title: `Title ${i}`, lever: "curiosity" })), thumbnails: [{ image: "Map", text: "WHO WINS?", emotion: "curious" }],
        hook: "If India and China both want the Teesta, who does Bangladesh choose?", format_id: "map-explainer", length_minutes: 10, beats: ["a", "b", "c"], search_terms: ["teesta"], shorts: ["Short 1"], risks: ["Check dates"],
      }),
      key_facts: () => ({ summary: "S", key_facts: [{ fact: "F", sources: [] }], timeline: [], numbers: [], quotes: [], other_side: ["O"], misconceptions: [], visuals: [{ show: "Map", where: "Wikimedia" }], gaps: ["G"] }),
      outline: () => ({ outline: "## Hook\n- beat" }),
      verify: () => ({ title: "Why the Teesta deal is stuck", script: "## Hook\nIf India and China both want the Teesta, who does Bangladesh choose?\n▸ Map", verify: [] }),
      shots: () => ({
        shots: [{ section: "Hook", shot: "Map", visual_source: "Wikimedia", on_screen_text: "", seconds: 5 }], thumbnails: [{ image: "Map", text: "WHO", emotion: "x", why: "y" }], title_options: ["T"],
        cutdowns: [{ from_section: "Hook", hook_line: "H", beats: "b", caption: "c", platform: "YouTube Shorts" }],
        captions: { youtube_description: "D", chapters: ["0:00 Hook"], instagram: "i", facebook: "f", tiktok: "t", hashtags: ["teesta"], pinned_comment: "p" },
      }),
    });
    useMock(mock);
    expect((await writeBrief(db, id)) as { ok: boolean }).toMatchObject({ ok: true });
    p = getProduction(db, id)!;
    expect(getBrief(p)?.angle).toBe("Bangladesh is the swing vote");
    expect(p.docs.hook).toContain("Teesta");
    expect(mock.calls[0].system).toContain("YOUTUBE STRATEGY PLAYBOOK");
    expect(await writeDossier(db, id)).toMatchObject({ ok: true });
    p = getProduction(db, id)!;
    expect(p.docs.dossier).toContain("## The other side");
    const direction = productionDirection(p);
    expect(direction).toContain("STRATEGY BRIEF");
    expect(direction).toContain("RESEARCH DOSSIER");
    await writeOutline(db, id, { hook: p.docs.hook, direction });
    await writeScript(db, id, { regenerate: true, direction });
    await packageContent(db, id, { regenerate: true });
    p = getProduction(db, id)!;
    expect(stepStatus(p)).toEqual({ brief: true, research: true, outline: true, script: true, package: true });
    // The format's structure and the brief reach the script writer.
    const scriptCall = mock.calls.find((c) => c.system.includes("Write the full script"))!;
    expect(scriptCall.user).toContain("FOLLOW THIS STRUCTURE");
    expect(scriptCall.user).toContain("Bangladesh is the swing vote");
    const pack = recordingPack(db, id)!;
    expect(pack).toContain("## Title options");
    expect(pack).toContain("## Script to read");
    expect(pack).toContain("## For the editor");
    expect(pack).toContain("## Shorts to cut");
  });

  it("builds an idea feed without failing on an empty desk", async () => {
    const db = freshDb();
    const yt = listYtChannels(db)[0];
    const ideas = await ideaFeed(db, yt.id);
    expect(Array.isArray(ideas)).toBe(true);
  });
});
