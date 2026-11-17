import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { readResearchFile, viewResearch } from "@/lib/research-inbox";

export const maxDuration = 120;

/** AI reads a saved screenshot or PDF (Bangla included). */
export const POST = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const db = getDb();
  const r = await readResearchFile(db, id, await body<{ estimateOnly?: boolean }>(req));
  return "ok" in r && r.ok ? { ...r, data: viewResearch(db, r.data) } : r;
});
