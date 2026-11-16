import { getDb } from "@/lib/db";
import { route } from "@/lib/http";
import { activeChannel } from "@/lib/channels";
import { getPulse } from "@/lib/ideation/pulse";

/** Refresh trending searches / most-read / on-this-day for the active channel's country (free, cached). */
export const POST = route(async () => {
  const db = getDb();
  const p = await getPulse(db, activeChannel(db).geo, true);
  return { ok: true, trends: p.trends.length, mostRead: p.mostRead.length };
});
