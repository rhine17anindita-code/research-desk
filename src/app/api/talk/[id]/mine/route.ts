import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { mineEpisode } from "@/lib/ideation/talk-mine";

export const maxDuration = 180;

/** AI read of a whole episode: claims, quotes, untold details and ideas. */
export const POST = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const b = await body<{ estimateOnly?: boolean; regenerate?: boolean }>(req);
  return mineEpisode(getDb(), id, b);
});
