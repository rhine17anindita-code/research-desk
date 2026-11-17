import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { deepenSources, rewriteSelection, writeHooks, writeOutline } from "@/lib/production-ai";

export const maxDuration = 180;

/** Script-writing steps: deepen sources (free), hooks, outline, rewrite a selection. */
export const POST = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const b = await body<{ step: "deepen" | "hooks" | "outline" | "rewrite"; estimateOnly?: boolean; direction?: string; preset?: string; hook?: string; selection?: string; instruction?: string }>(req);
  const db = getDb();
  if (b.step === "deepen") return { ok: true, result: await deepenSources(db, id) };
  if (b.step === "hooks") return writeHooks(db, id, b);
  if (b.step === "outline") return writeOutline(db, id, b);
  if (b.step === "rewrite") return rewriteSelection(db, id, { selection: b.selection ?? "", instruction: b.instruction ?? "Make it better", estimateOnly: b.estimateOnly, preset: b.preset });
  throw new Error("Unknown step");
});
