import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { nowIso } from "@/lib/ids";

export const PATCH = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const b = await body<{ weight?: number; enabled?: boolean; resetLearned?: boolean; cues?: string[] }>(req);
  const db = getDb();
  const cur = db.prepare("SELECT * FROM signals WHERE id = ?").get(id) as { weight: number; enabled: number; learned: number; cues: string } | undefined;
  if (!cur) throw new Error("Signal not found");
  db.prepare("UPDATE signals SET weight = ?, enabled = ?, learned = ?, cues = ?, updated_at = ? WHERE id = ?").run(
    b.weight === undefined ? cur.weight : Math.max(0, Math.min(3, b.weight)),
    b.enabled === undefined ? cur.enabled : b.enabled ? 1 : 0,
    b.resetLearned ? 0 : cur.learned,
    b.cues ? JSON.stringify(b.cues.map((c) => c.trim()).filter(Boolean)) : cur.cues,
    nowIso(), id,
  );
  return { ok: true };
});
export const DELETE = route(async (_req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  getDb().prepare("DELETE FROM signals WHERE id = ? AND builtin = 0").run(id);
  return { ok: true };
});
