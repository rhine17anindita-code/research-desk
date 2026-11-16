import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { deleteChannel, updateChannel, type Channel } from "@/lib/channels";

export const PATCH = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const b = await body<Partial<Pick<Channel, "name" | "description" | "profile" | "tasteSummary" | "geo" | "dailyIdeas">>>(req);
  const ch = updateChannel(getDb(), id, b);
  if (!ch) throw new Error("Channel not found");
  return { ok: true, channel: ch };
});
export const DELETE = route(async (_req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  deleteChannel(getDb(), id);
  return { ok: true };
});
