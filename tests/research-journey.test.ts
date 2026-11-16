import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ingestFeeds } from "@/lib/ingest/pipeline";
import { answerQuestion, generateQuestions, isEstimate, validateAnswer, buildSourcePack } from "@/lib/research/ai-tasks";
import { exploreSources, setRetrievalFetcherForTesting } from "@/lib/research/retrieval";
import { questionDetail } from "@/lib/research/question-detail";
import { assistantTurn } from "@/lib/research/assistant";
import { addToProject, createNote, createProject, listNotes, projectItemIds } from "@/lib/repo/projects";
import { linkQuestionSource, upsertSource } from "@/lib/repo/sources";
import { createLink, linksFor } from "@/lib/repo/links";
import { createQuestion, listQuestions, mergeQuestions } from "@/lib/repo/questions";
import { searchAll } from "@/lib/repo/search";
import { addFixtureFeeds, fixtureFetcher, freshDb, MockProvider, useMock } from "./helpers";
import type { DB } from "@/lib/db";
import type { Source } from "@/lib/types";

const QUESTIONS = {
  questions: [
    { text: "What dry-season water volumes, if any, does the Amber River framework guarantee to Ostrand?", dimension: "mechanism", rationale: "The announcement omits volumes.", answerability: "partial", priority: "high", search_queries: ["Amber River water sharing"] },
    { text: "Has Ostrand ever accepted limits on upstream dam construction in a past treaty?", dimension: "precedent", rationale: "Ostrand denies agreeing to limits.", answerability: "needs-investigation", priority: "normal", search_queries: ["transboundary river dam limits treaty"] },
    // Near-duplicate of the first: must be dropped.
    { text: "What dry-season water volumes does the Amber River framework guarantee to Ostrand?", dimension: "mechanism", rationale: "dup", answerability: "partial", priority: "low", search_queries: [] },
  ],
};

function mock() {
  return new MockProvider({
    questions: () => QUESTIONS,
    points: () => ({
      state: "established",
      summary: "Coverage says volumes were not specified.",
      points: [
        { text: "The framework did not specify volumes.", kind: "fact", sources: ["S1"] },
        { text: "Ostrand denies agreeing to dam limits.", kind: "fact", sources: ["S99"] }, // invented ref → dropped, flagged
        { text: "This ambiguity may favour the upstream state.", kind: "interpretation", sources: [] },
      ],
      caveats: [],
      next_steps: ["Request the framework text from both ministries."],
    }),
    reply: () => ({ reply: "Per the coverage [S1], volumes were not set. [S42] is made up.", cited: ["S1", "S42"], suggested_questions: ["Who drafted the framework?"] }),
  });
}

describe("research journey (news → questions → evidence → project → search)", () => {
  let db: DB;
  let provider: MockProvider;

  beforeEach(async () => {
    db = freshDb();
    addFixtureFeeds(db);
    await ingestFeeds(db, { fetcher: fixtureFetcher });
    provider = mock();
    useMock(provider);
    setRetrievalFetcherForTesting(async (url: string) => {
      if (url.includes("openalex")) {
        return { results: [{ id: "https://openalex.org/W1", doi: "https://doi.org/10.1000/xyz", title: "Upstream dams and transboundary water treaties", publication_date: "2019-05-01", authorships: [{ author: { display_name: "A. Researcher" } }], primary_location: { source: { display_name: "Water Policy" } }, abstract_inverted_index: { Treaties: [0], rarely: [1], cap: [2], dams: [3] }, type: "article" }] };
      }
      if (url.includes("wikipedia")) return { query: { pages: { "1": { title: "Transboundary river", extract: "A river crossing borders.", fullurl: "https://en.wikipedia.org/wiki/Transboundary_river", index: 1 } } } };
      if (url.includes("crossref")) throw new Error("HTTP 503");
      return { articles: [] };
    });
  });
  afterEach(() => {
    useMock(null);
    setRetrievalFetcherForTesting(null);
  });

  it("runs the full workflow and reuses AI output", async () => {
    const story = db.prepare("SELECT id FROM clusters WHERE headline LIKE '%Amber River%'").get() as { id: string };

    // Estimate is free and makes no call.
    const est = await generateQuestions(db, story.id, { estimateOnly: true });
    expect(isEstimate(est)).toBe(true);
    expect(provider.calls).toHaveLength(0);

    // 1. Generate questions (duplicates removed, stored permanently).
    const gen = await generateQuestions(db, story.id);
    expect(!isEstimate(gen) && gen.ok).toBe(true);
    const qs = listQuestions(db, { clusterId: story.id });
    expect(qs).toHaveLength(2);
    expect(qs[0].origin).toBe("ai");

    // 2. Grounded quick answer: the invented citation is removed and the claim flagged.
    const q = qs.find((x) => x.dimension === "mechanism")!;
    const ans = await answerQuestion(db, q.id, { level: 1 });
    expect(!isEstimate(ans) && ans.ok).toBe(true);
    const detail = questionDetail(db, q.id)!;
    const a = detail.answers[0];
    expect(a.points[0].sourceIds).toHaveLength(1);
    expect(a.points[1].unsupported).toBe(true);
    expect(a.points[1].sourceIds).toHaveLength(0);
    expect(a.points[2].unsupported).toBeUndefined();
    expect(a.caveats.join(" ")).toMatch(/not supplied/);
    expect(a.evidence).toHaveLength(1);
    expect(detail.sources.find((s) => s.id === a.evidence[0].sourceId)?.status).toBe("attached");

    // 3. Returning later: the same request is served from cache, no duplicate answer.
    const callsBefore = provider.calls.length;
    await answerQuestion(db, q.id, { level: 1 });
    expect(provider.calls.length).toBe(callsBefore);
    expect(questionDetail(db, q.id)!.answers.filter((x) => !x.superseded)).toHaveLength(1);

    // 4. Source exploration (no AI): partial provider failure is reported, results become candidates.
    const ex = await exploreSources(db, { questionId: q.id, queries: ["Amber River dams"], clusterId: story.id });
    expect(ex.outcomes.find((o) => o.provider === "crossref")?.error).toMatch(/503/);
    expect(ex.outcomes.find((o) => o.provider === "openalex")?.found).toBe(1);
    const paper = questionDetail(db, q.id)!.sources.find((s) => s.provider === "openalex")!;
    expect(paper.status).toBe("candidate");
    expect(paper.doi).toBe("10.1000/xyz");
    expect(paper.excerpt).toBe("Treaties rarely cap dams");
    linkQuestionSource(db, q.id, paper.id, "attached");
    expect(provider.calls.length).toBe(callsBefore);

    // 5. Manual source + typed connection.
    const report = upsertSource(db, { kind: "report", title: "Amber Basin Commission annual report", provider: "user", url: "https://example.org/report", saved: true });
    const other = qs.find((x) => x.id !== q.id)!;
    createLink(db, { fromType: "question", fromId: other.id, toType: "question", toId: q.id, relation: "related_to" });
    createLink(db, { fromType: "source", fromId: report.id, toType: "question", toId: q.id, relation: "supports" });
    expect(linksFor(db, "question", q.id)).toHaveLength(2);

    // 6. Project workspace with stories, questions, notes.
    const p = createProject(db, { title: "Who controls the Amber River?", thesis: "The framework leaves upstream power unchecked." });
    addToProject(db, p.id, "cluster", story.id);
    addToProject(db, p.id, "question", q.id);
    addToProject(db, p.id, "source", report.id);
    createNote(db, { projectId: p.id, body: "Call the basin commission about dry-season flows." });
    expect(projectItemIds(db, p.id, "question")).toEqual([q.id]);
    expect(listQuestions(db, { projectId: p.id }).map((x) => x.id)).toContain(q.id);

    // 7. Assistant: invented refs are stripped, its output is stored as assistant material.
    const turn = await assistantTurn(db, { contextType: "project", contextId: p.id, message: "What is still unknown?" });
    expect("ok" in turn && turn.ok).toBe(true);
    if ("ok" in turn && turn.ok) {
      const reply = turn.messages[1];
      expect(reply.content).toMatch(/\[\[src:src_/);
      expect(reply.content).toContain("[citation removed]");
      expect(reply.meta.citedSourceIds).toHaveLength(1);
    }

    // 8. Search across everything.
    const hits = searchAll(db, "dry-season");
    const kinds = new Set(hits.map((h) => h.kind));
    expect(kinds.has("question")).toBe(true);
    expect(kinds.has("note")).toBe(true);
    expect(searchAll(db, "Basin Commission", { kinds: ["source"] })).toHaveLength(1);
    expect(listNotes(db, { projectId: p.id })).toHaveLength(1);

    // 9. Combining questions keeps answers and archives the other.
    const extra = createQuestion(db, { clusterId: story.id, text: "Who benefits from vague volumes?", origin: "user" });
    const merged = mergeQuestions(db, [q.id, extra.id], "Who benefits from the framework's unspecified volumes?");
    expect(merged?.text).toMatch(/unspecified volumes/);
    expect(listQuestions(db, { clusterId: story.id }).some((x) => x.id === extra.id)).toBe(false);
    expect(questionDetail(db, q.id)!.answers.length).toBeGreaterThan(0);
  });

  it("refuses to answer without source material instead of inventing", async () => {
    const q = createQuestion(db, { text: "Zorblat qwixen frumious?", origin: "user" });
    setRetrievalFetcherForTesting(async () => ({ query: { pages: {} } })); // background lookup finds nothing
    const r = await answerQuestion(db, q.id);
    expect(!isEstimate(r) && !r.ok).toBe(true);
    expect(provider.calls).toHaveLength(0);
  });

  it("downgrades an 'established' verdict with no valid citations", () => {
    const pack = buildSourcePack([{ id: "src_1", kind: "news", title: "T", excerpt: "E" } as Source]);
    const v = validateAnswer({ state: "established", summary: "s", points: [{ text: "x", kind: "fact", sources: ["S7"] }], caveats: [], next_steps: [] }, pack);
    expect(v.state).toBe("insufficient");
    expect(v.points[0].unsupported).toBe(true);
    expect(v.droppedCitations).toBe(1);
  });
});
