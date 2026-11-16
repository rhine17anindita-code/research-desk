import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { addToProject, removeFromProject, type ProjectItemType } from "@/lib/repo/projects";

export const POST = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const b = await body<{ itemType: ProjectItemType; itemId: string; note?: string }>(req);
  addToProject(getDb(), id, b.itemType, b.itemId, b.note);
  return { ok: true };
});
export const DELETE = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const b = await body<{ itemType: string; itemId: string }>(req);
  removeFromProject(getDb(), id, b.itemType, b.itemId);
  return { ok: true };
});
