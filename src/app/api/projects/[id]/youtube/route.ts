import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { buildDescription, checks, diagnose, listYtChannels, setProjectYoutube, type Review } from "@/lib/youtube";
import { getProduction } from "@/lib/production";

export const GET = route(async (_req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const db = getDb();
  const p = getProduction(db, id);
  if (!p) throw new Error("Project not found");
  const review = (() => {
    try {
      return p.docs.yt_review ? (JSON.parse(p.docs.yt_review) as Review) : {};
    } catch {
      return {};
    }
  })();
  return {
    ok: true, ytChannelId: p.docs.yt_channel ?? null, format: p.docs.yt_format ?? null, channels: listYtChannels(db).map((c) => ({ id: c.id, name: c.name, status: c.status })),
    description: buildDescription(db, id), checks: checks(db, `project:${id}`), review, diagnosis: diagnose(review), title: p.title,
  };
});

export const PATCH = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  setProjectYoutube(getDb(), id, await body<{ ytChannelId?: string; format?: string; review?: Review }>(req));
  return { ok: true };
});
