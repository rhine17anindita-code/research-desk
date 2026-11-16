import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { nowIso } from "@/lib/ids";

export const PATCH = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const b = await body<{ enabled?: boolean; priority?: number; name?: string; region?: string }>(req);
  const db = getDb();
  const cur = db.prepare("SELECT * FROM feeds WHERE id = ?").get(id) as { enabled: number; priority: number; name: string; region: string } | undefined;
  if (!cur) throw new Error("Feed not found");
  db.prepare("UPDATE feeds SET enabled = ?, priority = ?, name = ?, region = ?, updated_at = ? WHERE id = ?").run(
    b.enabled === undefined ? cur.enabled : b.enabled ? 1 : 0,
    b.priority === undefined ? cur.priority : Math.max(0, Math.min(3, b.priority)),
    b.name ?? cur.name, b.region ?? cur.region, nowIso(), id,
  );
  return { ok: true };
});
/** Removing a feed keeps its already-collected articles (they may be evidence). */
export const DELETE = route(async (_req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  getDb().prepare("DELETE FROM feeds WHERE id = ?").run(id);
  return { ok: true };
});
