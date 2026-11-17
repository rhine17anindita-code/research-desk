import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { startProduction } from "@/lib/youtube/producer";

/** Start producing a video from an idea: makes the project, links the stories, picks a format (free). */
export const POST = route(async (req: Request) => {
  const b = await body<{ ytChannelId: string; title: string; notes?: string; storyId?: string | null }>(req);
  if (!b.title?.trim()) throw new Error("What's the video about?");
  return { ok: true, projectId: startProduction(getDb(), b) };
});
