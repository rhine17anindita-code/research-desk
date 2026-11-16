import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { deleteInspiration, updateInspiration, type InspirationIntent } from "@/lib/ideation/repo";

export const PATCH = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const b = await body<{ note?: string; intents?: InspirationIntent[]; title?: string }>(req);
  return { ok: true, inspiration: updateInspiration(getDb(), id, b) };
});
export const DELETE = route(async (_req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  deleteInspiration(getDb(), id);
  return { ok: true };
});
