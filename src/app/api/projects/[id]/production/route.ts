import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { updateProduction, type ProductionPatch } from "@/lib/production";

export const PATCH = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const p = updateProduction(getDb(), id, await body<ProductionPatch>(req));
  if (!p) throw new Error("Project not found");
  return { ok: true, production: p };
});
