import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { deleteIdea, getIdea, recordTaste, tagsOf, updateIdea, type IdeaStatus } from "@/lib/ideation/repo";

const EVENT: Partial<Record<IdeaStatus, string>> = { saved: "idea-save", skipped: "idea-skip", made: "idea-made", dropped: "idea-skip" };

/** Swipe actions: save / skip / made / dropped, with an optional reason. Each one teaches the taste profile. */
export const PATCH = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const b = await body<{ status?: IdeaStatus; reason?: string; title?: string; hook?: string; angle?: string; format?: string }>(req);
  const db = getDb();
  const cur = getIdea(db, id);
  if (!cur) throw new Error("Idea not found");
  const idea = updateIdea(db, id, { ...b, reason: b.reason ?? cur.reason });
  if (b.status && b.status !== cur.status && EVENT[b.status]) {
    recordTaste(db, { kind: EVENT[b.status]!, objectType: "idea", objectId: id, format: cur.format, angleType: cur.angleType, tags: tagsOf(`${cur.title} ${cur.angle ?? ""}`), reason: b.reason ?? null });
  }
  return { ok: true, idea };
});
export const DELETE = route(async (_req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  deleteIdea(getDb(), id);
  return { ok: true };
});
