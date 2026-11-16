import { getDb } from "@/lib/db";
import { route, type Ctx } from "@/lib/http";
import { developIdea } from "@/lib/ideation/develop";

export const POST = route(async (_req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  return { ok: true, ...developIdea(getDb(), id) };
});
