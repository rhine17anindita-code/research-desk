import { afterEach, describe, expect, it, vi } from "vitest";
import { freshDb } from "./helpers";
import { addVoiceSource, bannedHits, getProfile, listVoiceSources, setVoiceSourceText, styleBlock, updateProfile } from "@/lib/voice";
import { createProject } from "@/lib/repo/projects";
import { updateProduction } from "@/lib/production";
import { DEFAULT_BANNED, dialWord } from "@/lib/voice-shared";
import { modelForTask } from "@/lib/ai/task-models";

afterEach(() => vi.unstubAllGlobals());

describe("Voice Lab", () => {
  it("stores your scripts and inspirations; video links wait for the Mac helper", async () => {
    const db = freshDb();
    await addVoiceSource(db, { kind: "mine", text: "Look. Nobody in Dhaka is talking about this, and that's the problem.\nSo here's what happened." });
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 200 })); // no captions → helper
    const v = await addVoiceSource(db, { kind: "inspiration", url: "https://www.instagram.com/reel/ABC123/", creator: "PeekTV" });
    expect(v.status).toBe("queued");
    expect(v.platform).toBe("instagram");
    await expect(addVoiceSource(db, { kind: "inspiration", url: "https://www.instagram.com/reel/ABC123/" })).rejects.toThrow(/already/);
    setVoiceSourceText(db, v.id, { status: "ready", text: "Three things happened this week and the third one is wild." });
    expect(listVoiceSources(db).filter((s) => s.status === "ready")).toHaveLength(2);
  });

  it("builds the style block from guide, real examples, dials, blend and banned phrases", async () => {
    const db = freshDb();
    await addVoiceSource(db, { kind: "mine", text: "Look. Nobody in Dhaka is talking about this." });
    await addVoiceSource(db, { kind: "inspiration", text: "Map first. Then the twist.", creator: "TLDR" });
    const p = getProfile(db);
    updateProfile(db, { guideMine: "Opens with 'Look.'", guideInspiration: "Map-first explanations", dials: { ...p.dials, humour: 90, mood: 10, blend: 40 } });
    const s = styleBlock(db);
    expect(s).toContain("Opens with 'Look.'");
    expect(s).toContain("Nobody in Dhaka");
    expect(s).toContain("about 40% of their craft");
    expect(s).toContain("strongly lots of humour");
    expect(s).toContain("strongly hopeful");
    expect(s).toContain("NEVER USE");
    updateProfile(db, { dials: { ...getProfile(db).dials, blend: 0 } });
    expect(styleBlock(db)).not.toContain("Map-first");
  });

  it("presets override the default dials", () => {
    const db = freshDb();
    const p = getProfile(db);
    updateProfile(db, { presets: [{ name: "Hot take", dials: { ...p.dials, energy: 95 } }] });
    expect(styleBlock(db, { preset: "Hot take" })).toContain("strongly urgent");
    expect(styleBlock(db)).not.toContain("strongly urgent");
  });

  it("learns from your edits to an AI draft", () => {
    const db = freshDb();
    const pr = createProject(db, { title: "Teesta" });
    const ai = "## Open\nIn today's video we delve into the Teesta water deal and what it means for farmers in the north.\n\n## Close\nStay tuned.";
    updateProduction(db, pr.id, { docs: { script: ai, script_ai: ai } });
    updateProduction(db, pr.id, { docs: { script: "## Open\nLook. The Teesta deal decides whether farmers in the north eat this winter.\n\n## Close\nStay tuned." } });
    expect(getProfile(db).edits).toBe(1);
    expect(styleBlock(db)).toContain("LESSONS FROM THEIR EDITS");
    expect(styleBlock(db)).toContain("They changed it to");
  });

  it("catches banned phrases and words dials sensibly", () => {
    expect(bannedHits("Let's dive in! It's worth noting the tapestry.", DEFAULT_BANNED)).toEqual(expect.arrayContaining(["let's dive in", "it's worth noting", "tapestry"]));
    expect(dialWord(50, "Calm", "Urgent")).toBeNull();
    expect(dialWord(10, "Calm", "Urgent")).toBe("strongly calm");
    expect(dialWord(70, "Calm", "Urgent")).toBe("leaning urgent");
  });

  it("routes writing jobs to the right models", () => {
    expect(modelForTask("voice.analyse", {}, "x")).toBe("claude-opus-5-5");
    expect(modelForTask("script.hooks", {}, "x")).toBe("claude-opus-5-5");
    expect(modelForTask("polish.banned", {}, "x")).toBe("claude-sonnet-5-5");
  });
});
