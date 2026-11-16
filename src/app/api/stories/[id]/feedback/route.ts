import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { recordFeedback } from "@/lib/ranking";

export const POST = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const b = await body<{ kind: Parameters<typeof recordFeedback>[2]; reasons?: string[]; note?: string }>(req);
  recordFeedback(getDb(), id, b.kind, b.reasons ?? [], b.note);
  return { ok: true };
});
