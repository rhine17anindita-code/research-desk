import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { writeNote } from "@/lib/ideation/lens";

export const maxDuration = 60;

/** The editor's note for a story (cheapest model). */
export const POST = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  return writeNote(getDb(), id, await body<{ estimateOnly?: boolean }>(req));
});
