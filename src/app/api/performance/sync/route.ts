import { getDb } from "@/lib/db";
import { route } from "@/lib/http";
import { syncYoutube } from "@/lib/performance/youtube-sync";

export const maxDuration = 120;

/** Pull every YouTube upload with its numbers, plus recent comments (free; API key). */
export const POST = route(async () => {
  const r = await syncYoutube(getDb());
  if (!r) throw new Error("Couldn't reach your YouTube channel — check the YouTube link in Settings → Channels and the YOUTUBE_API_KEY.");
  return { ok: true, result: r };
});
