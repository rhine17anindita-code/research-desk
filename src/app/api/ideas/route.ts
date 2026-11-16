import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { createIdea, listIdeas, ideaCounts, updateIdea, type IdeaStatus } from "@/lib/ideation/repo";
import { FORMAT_BY_ID } from "@/lib/ideation/formats";

export const GET = route((req: Request) => {
  const u = new URL(req.url);
  const status = (u.searchParams.get("status") ?? "").split(",").filter(Boolean) as IdeaStatus[];
  const db = getDb();
  return {
    ok: true,
    ideas: listIdeas(db, { status: status.length ? status : undefined, format: u.searchParams.get("format") || undefined, medium: u.searchParams.get("medium") || undefined, limit: Number(u.searchParams.get("limit") ?? 200) }),
    counts: ideaCounts(db),
  };
});

/** Add your own idea (no AI). */
export const POST = route(async (req: Request) => {
  const b = await body<{ title: string; format?: string; angle?: string; hook?: string; clusterId?: string }>(req);
  if (!b.title?.trim()) throw new Error("An idea needs a title");
  const format = b.format && FORMAT_BY_ID[b.format] ? b.format : "youtube-long";
  const idea = createIdea(getDb(), {
    title: b.title, hook: b.hook ?? null, angle: b.angle ?? null, whyUntold: null, whyItLands: null, format, angleType: null,
    backing: { clusters: b.clusterId ? [b.clusterId] : [], sources: [], questions: [] }, openQuestions: [], effort: null, timeliness: null,
    origin: "user", batchId: null, inspirationId: null,
  });
  return { ok: true, idea: updateIdea(getDb(), idea.id, { status: "saved" }) };
});
