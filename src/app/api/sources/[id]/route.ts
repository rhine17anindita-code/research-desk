import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { deleteSource, getSource, sourceUsage, updateSource } from "@/lib/repo/sources";

export const GET = route(async (_req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const db = getDb();
  const source = getSource(db, id);
  if (!source) throw new Error("Source not found");
  return { ok: true, source, usage: sourceUsage(db, id) };
});
export const PATCH = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  return { ok: true, source: updateSource(getDb(), id, await body(req)) };
});
export const DELETE = route(async (_req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  deleteSource(getDb(), id);
  return { ok: true };
});
