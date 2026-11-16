import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { deleteQuestion, updateQuestion } from "@/lib/repo/questions";
import { questionDetail } from "@/lib/research/question-detail";

export const GET = route(async (_req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const d = questionDetail(getDb(), id);
  if (!d) throw new Error("Question not found");
  return { ok: true, ...d };
});
export const PATCH = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const q = updateQuestion(getDb(), id, await body(req));
  if (!q) throw new Error("Question not found");
  return { ok: true, question: q };
});
export const DELETE = route(async (_req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  deleteQuestion(getDb(), id);
  return { ok: true };
});
