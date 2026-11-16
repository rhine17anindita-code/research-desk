import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { saveAnswer } from "@/lib/repo/questions";

/** The researcher's own finding. Stored as origin=user, never mixed with AI output. */
export const POST = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const b = await body<{ summary: string; state?: string; sourceIds?: string[] }>(req);
  if (!b.summary?.trim()) throw new Error("Write a finding first");
  const answer = saveAnswer(getDb(), {
    questionId: id, level: 0, state: b.state || "user", summary: b.summary.trim(), points: [], caveats: [], nextSteps: [], origin: "user",
    evidence: (b.sourceIds ?? []).map((sid) => ({ sourceId: sid, claim: b.summary.trim(), relation: "supports" as const })),
  });
  return { ok: true, answer };
});
