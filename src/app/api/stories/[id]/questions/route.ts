import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { generateQuestions } from "@/lib/research/ai-tasks";

export const POST = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  return generateQuestions(getDb(), id, await body(req));
});
