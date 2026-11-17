import { describe, expect, it } from "vitest";
import { tokenize, jaccard } from "@/lib/text";
import { cleanVideoBoilerplate } from "@/lib/ingest/rss";
import { modelForTask } from "@/lib/ai/task-models";
import { termMatcher, splitTerms } from "@/lib/channels";

describe("phase 1 helpers", () => {
  it("tokenises Bangla so Bangla headlines can be matched", () => {
    const a = tokenize("নিষিদ্ধ আওয়ামী লীগ নেতাদের নাশকতার পরিকল্পনা");
    const b = tokenize("আওয়ামী লীগ নেতাদের গোপন বৈঠক ফাঁস");
    expect(a.length).toBeGreaterThan(3);
    expect(jaccard(a, b)).toBeGreaterThan(0.2);
    expect(tokenize("The banks announced new policies")).toEqual(["bank", "announced", "policy"]);
  });

  it("strips video description boilerplate", () => {
    expect(cleanVideoBoilerplate("Folk music returns to Dhaka. Fair Use Disclaimer: This channel may use copyrighted material")).toBe("Folk music returns to Dhaka.");
    expect(cleanVideoBoilerplate("Subscribe now! #news #bd")).toBe("");
  });

  it("picks the model per job with overrides", () => {
    expect(modelForTask("ideas.generate", {}, "x")).toBe("claude-opus-5-5");
    expect(modelForTask("story.assess", {}, "x")).toBe("claude-haiku-5-5");
    expect(modelForTask("answers.quick", { answers: "claude-haiku-5-5" }, "x")).toBe("claude-haiku-5-5");
    expect(modelForTask("unknown.task", {}, "fallback")).toBe("fallback");
  });

  it("matches boost/mute terms as whole words", () => {
    const m = termMatcher(splitTerms("Trump, BNP"));
    expect(m("Trump says hello")).toEqual(["Trump"]);
    expect(m("Trumpet player")).toEqual([]);
    expect(m("BNP rally in Dhaka")).toEqual(["BNP"]);
  });
});
