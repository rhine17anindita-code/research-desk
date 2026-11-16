import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";

export const PATCH = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const b = await body<{ enabled?: boolean }>(req);
  getDb().prepare("UPDATE rules SET enabled = ? WHERE id = ?").run(b.enabled ? 1 : 0, id);
  return { ok: true };
});
export const DELETE = route(async (_req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  getDb().prepare("DELETE FROM rules WHERE id = ?").run(id);
  return { ok: true };
});
