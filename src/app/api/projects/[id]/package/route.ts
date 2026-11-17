import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { packageContent } from "@/lib/production-ai";

export const maxDuration = 180;

export const POST = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  return packageContent(getDb(), id, await body<{ estimateOnly?: boolean; regenerate?: boolean }>(req));
});
