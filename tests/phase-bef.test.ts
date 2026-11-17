import { describe, expect, it } from "vitest";
import { freshDb } from "./helpers";
import { getPrefs, prefsBlock, updatePrefs } from "@/lib/prefs";
import { storyLens } from "@/lib/ideation/lens";
import { modelForTask } from "@/lib/ai/task-models";
import { QUESTION_DIMENSIONS } from "@/lib/types";

function story(db: ReturnType<typeof freshDb>, id: string, headline: string, summary: string) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO clusters (id, headline, summary, first_seen_at, last_updated_at, article_count, source_count, entities, regions, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 3, 3, '["Bangladesh Bank","IMF"]', '["Bangladesh"]', ?, ?)`,
  ).run(id, headline, summary, now, now, now, now);
}

describe("preferences", () => {
  it("clamps values and turns them into instructions", () => {
    const db = freshDb();
    expect(getPrefs(db).notes).toBe(true);
    const p = updatePrefs(db, { boldness: 150, topics: { ...getPrefs(db).topics, world: 0, economy: 90 } });
    expect(p.boldness).toBe(100);
    const text = prefsBlock(db);
    expect(text).toContain("World news (not about Bangladesh): never");
    expect(text).toContain("Economy, money & prices: as much as possible");
    expect(text).toContain("provocative");
  });
});

describe("content lens (free)", () => {
  it("explains a money story: type, freshness, numbers, options and viewer questions", () => {
    const db = freshDb();
    story(db, "c1", "Bangladesh Bank raises policy rate to 10% as IMF loan talks resume", "Tk 5,000 crore liquidity support announced; inflation at 9.5 percent.");
    const lens = storyLens(db, "c1")!;
    expect(lens.type).toBe("Money & economy");
    expect(lens.freshness.tone).toBe("new");
    expect(lens.bangladesh).toContain("Bangladesh");
    expect(lens.numbers.join(" ")).toMatch(/crore|percent/);
    expect(lens.options).toHaveLength(3);
    expect(lens.questions.length).toBeGreaterThan(2);
    expect(storyLens(db, "nope")).toBeNull();
  });
});

describe("audience questions and notes", () => {
  it("files viewer questions separately and uses cheap models for notes", () => {
    expect(QUESTION_DIMENSIONS).toContain("audience");
    expect(modelForTask("story.note", {}, "x")).toBe("claude-haiku-5-5");
    expect(modelForTask("questions.audience", {}, "x")).toBe("claude-sonnet-5-5");
  });
});
