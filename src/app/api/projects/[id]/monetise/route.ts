import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { planFor } from "@/lib/monetise";
import { updateProduction } from "@/lib/production";

export const GET = route(async (_req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  return { ok: true, plan: planFor(getDb(), id) };
});

/** Save which monetisation ideas you picked for this project. */
export const PATCH = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const b = await body<{ picks: string[] }>(req);
  updateProduction(getDb(), id, { docs: { monetise: JSON.stringify((b.picks ?? []).slice(0, 50)) } });
  return { ok: true };
});
