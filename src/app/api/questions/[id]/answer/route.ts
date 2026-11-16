import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { answerQuestion } from "@/lib/research/ai-tasks";

export const POST = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const b = await body<{ level?: 1 | 2; regenerate?: boolean; estimateOnly?: boolean; explore?: boolean }>(req);
  return answerQuestion(getDb(), id, b);
});
