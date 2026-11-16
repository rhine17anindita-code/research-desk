import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { linkQuestionSource, questionSources, sourceForArticle } from "@/lib/repo/sources";

export const GET = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const status = new URL(req.url).searchParams.get("status") ?? "attached";
  return { ok: true, sources: questionSources(getDb(), id, [status]) };
});

export const POST = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const b = await body<{ sourceId?: string; articleId?: string; status: "candidate" | "attached" | "rejected" }>(req);
  const db = getDb();
  const sourceId = b.sourceId ?? (b.articleId ? sourceForArticle(db, b.articleId)?.id : undefined);
  if (!sourceId) throw new Error("Source not found");
  linkQuestionSource(db, id, sourceId, b.status ?? "attached", b.articleId ? "story coverage" : undefined);
  return { ok: true, sourceId };
});
