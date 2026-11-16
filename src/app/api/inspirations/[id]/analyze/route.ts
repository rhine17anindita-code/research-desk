import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { analyzeInspiration } from "@/lib/ideation/ai";

export const POST = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  return analyzeInspiration(getDb(), id, await body(req));
});
