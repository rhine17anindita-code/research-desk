import { getDb } from "@/lib/db";
import { json, route } from "@/lib/http";
import { verifyHelper } from "@/lib/helper-auth";
import { nowIso } from "@/lib/ids";
import { getSetting, setSetting } from "@/lib/repo/settings";
import { youtubeId } from "@/lib/media";

/** Work for the Mac helper: transcripts this server can't fetch itself (YouTube blocks it). */
export const GET = route((req: Request) => {
  if (!verifyHelper(req)) return json({ ok: false, message: "Not signed by the helper" }, 401);
  const db = getDb();
  setSetting(db, "helper.seen_at", nowIso());
  const queued = db.prepare("SELECT video_id AS videoId, article_id AS articleId FROM transcripts WHERE status = 'queued' ORDER BY fetched_at DESC LIMIT 60").all() as { videoId: string; articleId: string | null }[];
  // While the server is blocked, also fetch ahead: recent talk-show episodes with no transcript yet.
  const blocked = getSetting(db, "transcripts.blocked_at");
  const ahead = blocked
    ? (db
        .prepare(
          `SELECT a.id AS articleId, a.url FROM articles a JOIN feeds f ON f.id = a.feed_id
           WHERE f.category = 'talk' AND f.enabled = 1 AND COALESCE(a.published_at, a.fetched_at) >= datetime('now', '-3 days')
           ORDER BY COALESCE(a.published_at, a.fetched_at) DESC LIMIT 200`,
        )
        .all() as { articleId: string; url: string }[])
        .map((r) => ({ videoId: youtubeId(r.url), articleId: r.articleId }))
        .filter((r): r is { videoId: string; articleId: string } => !!r.videoId && !db.prepare("SELECT 1 FROM transcripts WHERE video_id = ?").get(r.videoId))
        .slice(0, 40)
    : [];
  const lang = (articleId: string | null) =>
    articleId ? ((db.prepare("SELECT COALESCE(a.language, f.language, 'en') AS l FROM articles a LEFT JOIN feeds f ON f.id = a.feed_id WHERE a.id = ?").get(articleId) as { l: string } | undefined)?.l ?? "en") : "en";
  const seen = new Set<string>();
  const jobs = [...queued, ...ahead].filter((j) => (seen.has(j.videoId) ? false : (seen.add(j.videoId), true))).map((j) => ({ ...j, lang: lang(j.articleId).slice(0, 2) }));
  return { ok: true, jobs };
});
