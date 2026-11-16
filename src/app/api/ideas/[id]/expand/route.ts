import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { expandPitch } from "@/lib/ideation/pitch";

export const maxDuration = 180;

export const POST = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  return expandPitch(getDb(), id, await body(req));
});
