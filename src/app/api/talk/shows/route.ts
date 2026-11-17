import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { setTalkShow, talkShows } from "@/lib/ideation/talk";

export const GET = route(() => ({ ok: true, shows: talkShows(getDb()) }));

/** Switch a talk show on or off for the active channel. */
export const POST = route(async (req: Request) => {
  const b = await body<{ feedId: string; on: boolean }>(req);
  if (!b.feedId) throw new Error("Which show?");
  const db = getDb();
  setTalkShow(db, b.feedId, !!b.on);
  return { ok: true, shows: talkShows(db) };
});
