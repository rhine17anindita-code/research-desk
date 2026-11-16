import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { deleteNote, updateNote } from "@/lib/repo/projects";

export const PATCH = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  return { ok: true, note: updateNote(getDb(), id, await body(req)) };
});
export const DELETE = route(async (_req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  deleteNote(getDb(), id);
  return { ok: true };
});
