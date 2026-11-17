import { getDb } from "./db";
import { ingestFeeds } from "./ingest/pipeline";
import { getSetting } from "./repo/settings";

const g = globalThis as unknown as { __ingestTimer?: NodeJS.Timeout };

/** Minutes between automatic checks: the env var wins when set ≥5, else Settings (default 15; 0 = off). */
export function ingestIntervalMinutes(): number {
  const env = Number(process.env.INGEST_INTERVAL_MINUTES ?? 0);
  if (env >= 5) return env;
  try {
    return Math.max(0, Number(getSetting(getDb(), "ingest.interval_minutes")) || 0);
  } catch {
    return 15;
  }
}

/**
 * In-process schedule: checks once a minute whether feeds are due and pulls them.
 * No AI calls. Housekeeping (cache pruning) runs alongside.
 */
export function startScheduler() {
  if (g.__ingestTimer) return;
  let busy = false;
  const tick = async () => {
    if (busy) return;
    const minutes = ingestIntervalMinutes();
    if (minutes < 5) return;
    const db = getDb();
    const last = (db.prepare("SELECT MAX(started_at) AS t FROM ingest_runs").get() as { t: string | null }).t;
    if (last && Date.now() - Date.parse(last) < minutes * 60_000) return;
    busy = true;
    try {
      const r = await ingestFeeds(db, { trigger: "scheduled" });
      console.log(`[scheduler] ingest: +${r.articlesNew} articles, ${r.clustersNew} new stories, ${r.feedsFailed} feed errors`);
      db.prepare("DELETE FROM ai_cache WHERE created_at < datetime('now', '-90 days')").run();
      // The creator's own YouTube numbers and comments, every 6 hours.
      const { syncYoutubeIfStale } = await import("./performance/youtube-sync");
      await syncYoutubeIfStale(db, 6);
    } catch (err) {
      console.error("[scheduler] ingest failed", (err as Error).message);
    } finally {
      busy = false;
    }
  };
  setTimeout(tick, 15_000).unref?.();
  g.__ingestTimer = setInterval(tick, 60_000);
  g.__ingestTimer.unref?.();
  console.log("[scheduler] checking feeds automatically");
}
