import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { createQuestion, listQuestions } from "@/lib/repo/questions";
import { addToProject } from "@/lib/repo/projects";

export const GET = route((req: Request) => {
  const u = new URL(req.url);
  return { ok: true, questions: listQuestions(getDb(), { clusterId: u.searchParams.get("clusterId") ?? undefined, projectId: u.searchParams.get("projectId") ?? undefined }) };
});

export const POST = route(async (req: Request) => {
  const b = await body<{ clusterId?: string; projectId?: string; parentId?: string; text: string; dimension?: string; rationale?: string; origin?: "user" | "assistant" }>(req);
  if (!b.text?.trim()) throw new Error("A question needs text");
  const db = getDb();
  const q = createQuestion(db, { ...b, origin: b.origin === "assistant" ? "assistant" : "user" });
  if (b.projectId) addToProject(db, b.projectId, "question", q.id);
  return { ok: true, question: q };
});
