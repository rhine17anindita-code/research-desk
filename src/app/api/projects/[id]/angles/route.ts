import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { findAngles } from "@/lib/research/creator";

export const POST = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  return findAngles(getDb(), id, await body(req));
});
