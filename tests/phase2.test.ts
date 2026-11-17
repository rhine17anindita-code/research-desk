import { describe, expect, it } from "vitest";
import { freshDb } from "./helpers";
import { createProject } from "@/lib/repo/projects";
import { getProduction, listProductions, progressOf, updateProduction } from "@/lib/production";
import { EVERGREEN_BANK, topUpEvergreen } from "@/lib/ideation/evergreen";
import { listIdeas } from "@/lib/ideation/repo";
import { storiesToBuild } from "@/lib/ideation/build-stories";
import { talkEpisodes } from "@/lib/ideation/talk";
import { modelForTask } from "@/lib/ai/task-models";

describe("phase 2: production, evergreen ideas, talk shows", () => {
  it("tracks production stage, docs, date and progress", () => {
    const db = freshDb();
    const p = createProject(db, { title: "Why Dhaka can't fix its traffic" });
    expect(getProduction(db, p.id)!.progress).toBe(0);
    const u = updateProduction(db, p.id, { stage: "script", contentType: "short", publishDate: "2026-12-01", platforms: ["youtube", "tiktok", "myspace"], docs: { script: "x".repeat(40) } })!;
    expect(u.contentType).toBe("short");
    expect(u.platforms).toEqual(["youtube", "tiktok"]);
    expect(u.publishDate).toBe("2026-12-01");
    expect(u.progress).toBe(progressOf("script", { script: "x".repeat(40) }));
    expect(updateProduction(db, p.id, { stage: "live" })!.progress).toBe(100);
    expect(updateProduction(db, p.id, { publishDate: "next tuesday" })!.publishDate).toBeNull();
    expect(listProductions(db).map((x) => x.projectId)).toContain(p.id);
  });

  it("keeps evergreen ideas waiting without AI, never repeating one", () => {
    const db = freshDb();
    expect(topUpEvergreen(db, 6)).toBe(6);
    expect(topUpEvergreen(db, 6)).toBe(0);
    const ideas = listIdeas(db, { status: "new", limit: 50 }).filter((i) => i.sourceKind === "evergreen");
    expect(ideas).toHaveLength(6);
    expect(new Set(ideas.map((i) => i.title)).size).toBe(6);
    expect(EVERGREEN_BANK.every((b) => b.verify.length > 0)).toBe(true);
  });

  it("builds story and talk-show lists on an empty database", async () => {
    const db = freshDb();
    expect(storiesToBuild(db)).toEqual([]);
    expect(await talkEpisodes(db)).toEqual([]);
  });

  it("packages with Sonnet and writes scripts with Opus by default", () => {
    expect(modelForTask("package.content", {}, "x")).toBe("claude-sonnet-5-5");
    expect(modelForTask("script.write", {}, "x")).toBe("claude-opus-5-5");
  });
});
