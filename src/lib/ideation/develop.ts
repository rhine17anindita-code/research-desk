import type { DB } from "../db";
import { addToProject, createNote, createProject } from "../repo/projects";
import { createQuestion } from "../repo/questions";
import { FORMAT_BY_ID } from "./formats";
import { getIdea, recordTaste, tagsOf, updateIdea } from "./repo";

/** Turn an idea into a research project: story, sources, open questions and the angle, ready to outline. */
export function developIdea(db: DB, ideaId: string): { projectId: string } {
  const idea = getIdea(db, ideaId);
  if (!idea) throw new Error("Idea not found");
  if (idea.projectId) return { projectId: idea.projectId };
  const fmt = FORMAT_BY_ID[idea.format];
  const project = createProject(db, { title: idea.title, thesis: idea.angle, stage: "investigating" });
  db.prepare("UPDATE projects SET angles = ?, description = ? WHERE id = ?").run(
    [idea.hook ? `Hook: ${idea.hook}` : "", `Format: ${fmt?.label ?? idea.format}`, idea.whyItLands ? `Why it lands: ${idea.whyItLands}` : ""].filter(Boolean).join("\n"),
    idea.whyUntold ? `Why it's untold: ${idea.whyUntold}` : null,
    project.id,
  );
  for (const c of idea.backing.clusters) addToProject(db, project.id, "cluster", c);
  for (const s of idea.backing.sources) addToProject(db, project.id, "source", s);
  for (const q of idea.openQuestions) {
    const created = createQuestion(db, { projectId: project.id, clusterId: idea.backing.clusters[0] ?? null, text: q, answerState: "needs-investigation", origin: "ai" });
    addToProject(db, project.id, "question", created.id);
  }
  createNote(db, {
    projectId: project.id,
    title: "Original idea (AI)",
    origin: "assistant",
    body: [idea.title, idea.hook && `Hook: ${idea.hook}`, idea.angle && `Angle: ${idea.angle}`, idea.whyUntold && `Why untold: ${idea.whyUntold}`].filter(Boolean).join("\n"),
  });
  updateIdea(db, ideaId, { status: "developing", projectId: project.id });
  recordTaste(db, { kind: "idea-develop", objectType: "idea", objectId: ideaId, format: idea.format, angleType: idea.angleType, tags: tagsOf(`${idea.title} ${idea.angle ?? ""}`) });
  return { projectId: project.id };
}
