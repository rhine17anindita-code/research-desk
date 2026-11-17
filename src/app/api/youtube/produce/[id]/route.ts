import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { getProduction } from "@/lib/production";
import { getYtChannel } from "@/lib/youtube";
import { getBrief, prompterText, productionDirection, recordingPack, stepStatus, voiceReady, writeBrief, writeDossier, type Step } from "@/lib/youtube/producer";
import { packageContent, writeOutline, writeScript } from "@/lib/production-ai";

export const maxDuration = 300;

export const GET = route(async (_req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const db = getDb();
  const p = getProduction(db, id);
  if (!p) throw new Error("Project not found");
  return {
    ok: true, title: p.title, status: stepStatus(p), brief: getBrief(p), dossier: p.docs.dossier ?? "", outline: p.docs.outline ?? "", script: p.docs.script ?? "",
    hook: p.docs.hook ?? "", format: p.docs.yt_format ?? null, channel: p.docs.yt_channel ? getYtChannel(db, p.docs.yt_channel)?.name ?? null : null,
    prompter: prompterText(p.docs.script ?? ""), pack: recordingPack(db, id), publishDate: p.publishDate, voiceReady: voiceReady(db), solutions: p.docs.solutions === "on", contentType: p.contentType, timing: p.docs.timing ?? "",
  };
});

/** Run one production step (AI), or estimate its cost. */
export const POST = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const b = await body<{ step: Step; estimateOnly?: boolean; direction?: string }>(req);
  const db = getDb();
  const p = getProduction(db, id);
  if (!p) throw new Error("Project not found");
  const direction = [productionDirection(p), b.direction ? `CREATOR'S DIRECTION: ${b.direction}` : ""].filter(Boolean).join("\n\n");
  switch (b.step) {
    case "brief": return writeBrief(db, id, { estimateOnly: b.estimateOnly, direction: b.direction });
    case "research": return writeDossier(db, id, { estimateOnly: b.estimateOnly });
    case "outline": return writeOutline(db, id, { estimateOnly: b.estimateOnly, hook: p.docs.hook, direction });
    case "script": return writeScript(db, id, { estimateOnly: b.estimateOnly, regenerate: true, direction });
    case "package": return packageContent(db, id, { estimateOnly: b.estimateOnly, regenerate: true });
    default: throw new Error("Unknown step");
  }
});
