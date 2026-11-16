import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { addToProject, createProject, listProjects, type ProjectItemType } from "@/lib/repo/projects";

export const GET = route(() => ({ ok: true, projects: listProjects(getDb()) }));

export const POST = route(async (req: Request) => {
  const b = await body<{ title: string; thesis?: string; stage?: string; item?: { type: ProjectItemType; id: string } }>(req);
  if (!b.title?.trim()) throw new Error("A project needs a title");
  const db = getDb();
  const project = createProject(db, b);
  if (b.item) addToProject(db, project.id, b.item.type, b.item.id);
  return { ok: true, project };
});
