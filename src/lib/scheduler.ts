import { getDb } from "./db";
import { ingestFeeds } from "./ingest/pipeline";

const g = globalThis as unknown as { __ingestTimer?: NodeJS.Timeout };

/** Minutes between automatic checks: the env var wins when set ≥5, else Settings (default 15; 0 = off). */
export function ingestIntervalMinutes(): number {
  // Your choice in the Studio wins; the INGEST_INTERVAL_MINUTES env var is only the starting value.
  try {
    const row = getDb().prepare("SELECT value FROM settings WHERE key = 'ingest.interval_minutes'").get() as { value: string } | undefined;
    if (row) return Math.max(0, Number(JSON.parse(row.value)) || 0);
  } catch {
    /* fall through */
  }
  const env = Number(process.env.INGEST_INTERVAL_MINUTES ?? 0);
  return env >= 5 ? env : 10;
}

/**
 * In-process schedule: checks once a minute whether feeds are due and pulls them.
 * No AI calls. Housekeeping (cache pruning) runs alongside.
 */
let busy = false;

/** Run the scheduled work if it's due (no-op otherwise). Safe to call often — e.g. from the wake-up ping. */
export async function tickIfDue(): Promise<"ran" | "not-due" | "busy" | "off"> {
  if (busy) return "busy";
  if (ingestIntervalMinutes() < 5) return "off";
  const db = getDb();
  const last = (db.prepare("SELECT MAX(started_at) AS t FROM ingest_runs").get() as { t: string | null }).t;
  if (last && Date.now() - Date.parse(last) < ingestIntervalMinutes() * 60_000) return "not-due";
  await tick();
  return "ran";
}

export function startScheduler() {
  if (g.__ingestTimer) return;
  setTimeout(tick, 15_000).unref?.();
  g.__ingestTimer = setInterval(tick, 60_000);
  g.__ingestTimer.unref?.();
  console.log("[scheduler] checking feeds automatically");
}

async function tick() {
  {
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
      db.prepare("DELETE FROM ai_cache WHERE created_at < strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-90 days')").run();
      // Full articles for the stories that matter (free).
      const { fetchFullText } = await import("./ingest/fulltext");
      const ft = await fetchFullText(db, 120).catch(() => null);
      if (ft) console.log(`[scheduler] full text: ${ft.full} full, ${ft.summary} summary, ${ft.headline} headline-only, ${ft.blocked} for the helper`);
      // The creator's own YouTube numbers and comments, every 6 hours.
      const { syncYoutubeIfStale } = await import("./performance/youtube-sync");
      await syncYoutubeIfStale(db, 6);
      const { syncMetaIfStale } = await import("./performance/meta");
      await syncMetaIfStale(db, 6);
      // Editor's notes for the top new stories (cheapest model, capped at 8% of the monthly budget).
      const { autoNotes } = await import("./ideation/lens");
      const { getAiStatus } = await import("./ai/service");
      if (getAiStatus(db).available) await autoNotes(db, 8).catch((e) => console.error("[notes]", (e as Error).message));
    } catch (err) {
      console.error("[scheduler] ingest failed", (err as Error).message);
    } finally {
      busy = false;
    }
  }
}
