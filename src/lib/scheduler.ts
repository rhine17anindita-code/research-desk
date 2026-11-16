import { getDb } from "./db";
import { ingestFeeds } from "./ingest/pipeline";

const g = globalThis as unknown as { __ingestTimer?: NodeJS.Timeout };

/** Lightweight in-process schedule. Housekeeping (cache pruning) runs alongside. No AI calls. */
export function startScheduler(minutes: number) {
  if (g.__ingestTimer) return;
  const run = async () => {
    try {
      const db = getDb();
      const r = await ingestFeeds(db, { trigger: "scheduled" });
      console.log(`[scheduler] ingest: +${r.articlesNew} articles, ${r.clustersNew} new stories, ${r.feedsFailed} feed errors`);
      // Housekeeping: drop cache entries older than 90 days.
      db.prepare("DELETE FROM ai_cache WHERE created_at < datetime('now', '-90 days')").run();
    } catch (err) {
      console.error("[scheduler] ingest failed", (err as Error).message);
    }
  };
  setTimeout(run, 10_000);
  g.__ingestTimer = setInterval(run, minutes * 60_000);
  console.log(`[scheduler] feeds refresh every ${minutes} min`);
}
