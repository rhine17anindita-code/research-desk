import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { setFeedChannel } from "@/lib/channels";

export const POST = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const b = await body<{ feedId: string; on: boolean }>(req);
  setFeedChannel(getDb(), id, b.feedId, !!b.on);
  return { ok: true };
});
