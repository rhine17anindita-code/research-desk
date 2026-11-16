import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { getQuestion } from "@/lib/repo/questions";
import { getStory } from "@/lib/repo/stories";
import { exploreSources, type ProviderId } from "@/lib/research/retrieval";
import { keywordQuery } from "@/lib/text";

/** Level 2 source exploration without any model call. */
export const POST = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const b = await body<{ query?: string; providers?: ProviderId[] }>(req);
  const db = getDb();
  const q = getQuestion(db, id);
  if (!q) throw new Error("Question not found");
  const story = q.clusterId ? getStory(db, q.clusterId) : null;
  const queries = b.query?.trim() ? [b.query.trim()] : q.searchTerms.length ? q.searchTerms : [keywordQuery(`${q.text} ${story?.headline ?? ""}`)];
  const result = await exploreSources(db, { questionId: id, queries, clusterId: q.clusterId, providers: b.providers });
  return { ok: true, queries, ...result };
});
