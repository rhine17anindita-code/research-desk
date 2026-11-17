import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { addCompetitor, deleteCompetitor, refreshAllCompetitors } from "@/lib/youtube";

export const maxDuration = 120;

export const POST = route(async (req: Request) => {
  const b = await body<{ ytChannelId: string; link: string }>(req);
  return { ok: true, competitor: await addCompetitor(getDb(), b.ytChannelId, b.link) };
});
/** Refresh every competitor's latest videos (YouTube API, about 2 quota units each). */
export const PATCH = route(async (req: Request) => {
  const b = await body<{ ytChannelId: string }>(req);
  await refreshAllCompetitors(getDb(), b.ytChannelId);
  return { ok: true };
});
export const DELETE = route(async (req: Request) => {
  const b = await body<{ id: string }>(req);
  deleteCompetitor(getDb(), b.id);
  return { ok: true };
});
