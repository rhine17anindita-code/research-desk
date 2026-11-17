import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { liveStatus } from "@/lib/live";
import { getSetting, setSetting } from "@/lib/repo/settings";
import { nowIso } from "@/lib/ids";

/** What's new since the creator last looked (free, local). */
export const GET = route((req: Request) => {
  const db = getDb();
  const since = new URL(req.url).searchParams.get("since") ?? getSetting(db, "studio.seen_at");
  return { ok: true, live: liveStatus(db, since || null) };
});

/** Mark as seen, and/or change how often feeds are checked automatically. */
export const POST = route(async (req: Request) => {
  const b = await body<{ seen?: boolean; intervalMinutes?: number }>(req);
  const db = getDb();
  if (b.seen) setSetting(db, "studio.seen_at", nowIso());
  if (b.intervalMinutes !== undefined) {
    const m = Number(b.intervalMinutes);
    if (![0, 5, 10, 15, 30, 60].includes(m)) throw new Error("Choose 5, 10, 15, 30 or 60 minutes, or off");
    setSetting(db, "ingest.interval_minutes", m);
  }
  return { ok: true };
});
