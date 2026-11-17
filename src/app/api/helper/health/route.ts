import { getDb } from "@/lib/db";
import { json, route } from "@/lib/http";
import { verifyHelper } from "@/lib/helper-auth";
import { ingestIntervalMinutes } from "@/lib/scheduler";

/** Freshness check for the helper/maintainer (signed): no content, just times and counts. */
export const GET = route((req: Request) => {
  if (!verifyHelper(req)) return json({ ok: false, message: "Not signed by the helper" }, 401);
  const db = getDb();
  const runs = db.prepare("SELECT trigger, started_at, finished_at, feeds_ok, feeds_failed, articles_new FROM ingest_runs ORDER BY started_at DESC LIMIT 6").all();
  const newest = db.prepare(
    `SELECT COALESCE(f.category, '?') AS category, MAX(COALESCE(a.published_at, a.fetched_at)) AS newest, MAX(a.fetched_at) AS fetched, COUNT(*) AS n24
     FROM articles a JOIN feeds f ON f.id = a.feed_id WHERE a.fetched_at >= strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-24 hours') GROUP BY f.category`,
  ).all();
  const failing = db.prepare("SELECT category, COUNT(*) AS n FROM feeds WHERE enabled = 1 AND last_status = 'error' GROUP BY category").all();
  return { ok: true, uptimeMin: Math.round(process.uptime() / 60), intervalMin: ingestIntervalMinutes(), runs, newest, failing };
});
