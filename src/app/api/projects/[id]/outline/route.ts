import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { draftOutline, type FormatId } from "@/lib/research/creator";

export const maxDuration = 180;

export const POST = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const b = await body<{ format?: FormatId; angle?: string; estimateOnly?: boolean; regenerate?: boolean }>(req);
  return draftOutline(getDb(), id, { ...b, format: b.format ?? "youtube-explainer" });
});
