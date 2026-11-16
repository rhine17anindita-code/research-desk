import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { deleteAnswer, supersedeAnswer } from "@/lib/repo/questions";

export const PATCH = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const b = await body<{ superseded?: boolean }>(req);
  supersedeAnswer(getDb(), id, !!b.superseded);
  return { ok: true };
});
export const DELETE = route(async (_req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  deleteAnswer(getDb(), id);
  return { ok: true };
});
