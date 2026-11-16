import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { deepResearch } from "@/lib/research/ai-tasks";

export const maxDuration = 300;

export const POST = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  return deepResearch(getDb(), id, await body(req));
});
