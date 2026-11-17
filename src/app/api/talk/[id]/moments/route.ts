import { getDb } from "@/lib/db";
import { route, type Ctx } from "@/lib/http";
import { findMoments, transcriptFor } from "@/lib/transcripts";

/** Key moments of an episode: transcript from YouTube captions, scanned locally (free). */
export const GET = route(async (_req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const db = getDb();
  const t = await transcriptFor(db, id);
  if (!t) throw new Error("Not a YouTube episode");
  if (t.status !== "ok") return { ok: true, available: false, reason: t.error ?? "This episode has no captions on YouTube." };
  return { ok: true, available: true, language: t.language, kind: t.kind, chars: t.chars, moments: findMoments(db, t), mined: t.mined };
});
