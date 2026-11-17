import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { deleteResearch, updateResearch, viewResearch } from "@/lib/research-inbox";

export const PATCH = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const db = getDb();
  const item = updateResearch(db, id, await body(req));
  if (!item) throw new Error("Item not found");
  return { ok: true, item: viewResearch(db, item) };
});
export const DELETE = route(async (_req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  deleteResearch(getDb(), id);
  return { ok: true };
});
