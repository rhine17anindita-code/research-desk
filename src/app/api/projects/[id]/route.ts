import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { deleteProject, updateProject } from "@/lib/repo/projects";

export const PATCH = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  return { ok: true, project: updateProject(getDb(), id, await body(req)) };
});
export const DELETE = route(async (_req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  deleteProject(getDb(), id);
  return { ok: true };
});
