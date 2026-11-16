import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { mergeClusterInto } from "@/lib/ingest/pipeline";
import { getStory } from "@/lib/repo/stories";

/** Manually combine this story into another; questions, notes, links and projects move with it. */
export const POST = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const b = await body<{ into: string }>(req);
  const db = getDb();
  if (!b.into || b.into === id) throw new Error("Choose a different story to merge into");
  if (!getStory(db, id) || !getStory(db, b.into)) throw new Error("Story not found");
  mergeClusterInto(db, id, b.into);
  return { ok: true, into: b.into };
});
