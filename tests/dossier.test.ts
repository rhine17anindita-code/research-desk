import { describe, expect, it } from "vitest";
import { addToProject, createNote, createProject } from "@/lib/repo/projects";
import { createQuestion, saveAnswer } from "@/lib/repo/questions";
import { upsertSource } from "@/lib/repo/sources";
import { buildDossier, dossierMarkdown } from "@/lib/research/dossier";
import { freshDb } from "./helpers";

describe("dossier export", () => {
  it("includes questions, answers with numbered references, notes and a reference list", () => {
    const db = freshDb();
    const p = createProject(db, { title: "Teesta water", thesis: "Who controls dry-season flow?" });
    const q = createQuestion(db, { projectId: p.id, text: "What does the 2011 draft deal say?", origin: "user" });
    addToProject(db, p.id, "question", q.id);
    const s = upsertSource(db, { kind: "report", title: "Teesta draft agreement analysis", provider: "user", url: "https://example.org/teesta", publisher: "Example Institute" });
    saveAnswer(db, {
      questionId: q.id, level: 1, state: "partial", summary: "The draft split flows roughly evenly.", origin: "ai",
      points: [
        { text: "Draft proposed a near-even split.", kind: "fact", sourceIds: [s.id] },
        { text: "West Bengal objected.", kind: "background", sourceIds: [] },
      ],
      caveats: [], nextSteps: ["Obtain the draft text."], evidence: [{ sourceId: s.id, claim: "split" }],
    });
    createNote(db, { projectId: p.id, body: "Call the river commission." });
    const md = dossierMarkdown(buildDossier(db, p.id)!);
    expect(md).toContain("# Teesta water");
    expect(md).toContain("Draft proposed a near-even split. [1]");
    expect(md).toContain("*(unverified background)*");
    expect(md).toContain("1. Teesta draft agreement analysis. Example Institute.");
    expect(md).toContain("Call the river commission.");
  });
});
