import type { DB } from "../db";
import { getText, isPublicHttpUrl } from "../ideation/metadata";
import { articleText } from "../research-inbox";
import { jaccard, truncate, uniqueTokens } from "../text";

/**
 * After each refresh, read the full article for the stories that matter — top and in-focus
 * stories, anything in a project — once, for free. Google News links can't be read; when the same
 * article also came in through the outlet's own feed, its direct link and text are used instead.
 * Sites that refuse this server are retried by the Mac helper from home internet.
 */

const FULL = 1200; // characters: shorter usually means a paywall teaser or a blocked page

interface Row { id: string; url: string; title: string; cluster_id: string | null; publisher: string | null }

export function articlesNeedingText(db: DB, limit = 40): Row[] {
  return db
    .prepare(
      `SELECT a.id, a.url, a.title, a.cluster_id, a.publisher FROM articles a
       WHERE a.text_status IS NULL AND a.is_sample = 0 AND a.url NOT LIKE '%youtube.com%' AND a.url NOT LIKE '%youtu.be%'
         AND a.cluster_id IN (
           SELECT id FROM (SELECT id FROM clusters WHERE last_updated_at >= datetime('now', '-48 hours') AND source_count >= 2 AND state != 'dismissed' ORDER BY source_count DESC LIMIT 80)
           UNION SELECT item_id FROM project_items WHERE item_type = 'cluster'
         )
       ORDER BY a.fetched_at DESC LIMIT ?`,
    )
    .all(limit) as Row[];
}

export function saveText(db: DB, id: string, status: string, text?: string | null, directUrl?: string | null) {
  db.prepare("UPDATE articles SET text_status = ?, full_text = COALESCE(?, full_text), direct_url = COALESCE(?, direct_url) WHERE id = ?").run(status, text ? truncate(text, 20000) : null, directUrl ?? null, id);
  if (text) {
    const s = db.prepare("SELECT id, excerpt FROM sources WHERE article_id = ?").get(id) as { id: string; excerpt: string | null } | undefined;
    if (s && (s.excerpt?.length ?? 0) < text.length) db.prepare("UPDATE sources SET excerpt = ? WHERE id = ?").run(truncate(text, 20000), s.id);
  }
}

/** The same article from the outlet's own feed, in the same story (Google News duplicates). */
function directTwin(db: DB, a: Row): { id: string; url: string; full_text: string | null } | null {
  if (!a.cluster_id) return null;
  const toks = new Set(uniqueTokens(a.title.replace(/\s[-–—|]\s[^-–—|]+$/, "")));
  const cands = db.prepare("SELECT id, url, title, full_text FROM articles WHERE cluster_id = ? AND id != ? AND url NOT LIKE '%news.google.com%'").all(a.cluster_id, a.id) as {
    id: string; url: string; title: string; full_text: string | null;
  }[];
  let best: (typeof cands)[number] | null = null;
  let score = 0;
  for (const c of cands) {
    const sc = jaccard(toks, new Set(uniqueTokens(c.title)));
    if (sc > score) { score = sc; best = c; }
  }
  return best && score >= 0.6 ? best : null;
}

export async function fetchFullText(db: DB, limit = 40): Promise<{ full: number; summary: number; headline: number; blocked: number }> {
  const todo = articlesNeedingText(db, limit);
  const out = { full: 0, summary: 0, headline: 0, blocked: 0 };
  let i = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (i < todo.length) {
        const a = todo[i++];
        if (/news\.google\.com/.test(a.url)) {
          const twin = directTwin(db, a);
          if (twin?.full_text) {
            saveText(db, a.id, "full", twin.full_text, twin.url);
            out.full++;
          } else if (twin) {
            // Its twin hasn't been read yet: keep the clean link now, the text comes at the end of this run.
            saveText(db, a.id, "headline", null, twin.url);
            out.headline++;
          } else {
            saveText(db, a.id, "headline");
            out.headline++;
          }
          continue;
        }
        if (!isPublicHttpUrl(a.url)) { saveText(db, a.id, "failed"); continue; }
        try {
          const text = articleText(await getText(a.url, "text/html", 3_000_000));
          const status = text.length >= FULL ? "full" : "summary";
          saveText(db, a.id, status, text.length >= 300 ? text : null);
          out[status]++;
        } catch (e) {
          // Refused (403/429…) — often just this server's address: the Mac helper retries from home.
          const m = (e as Error).message;
          const blocked = /HTTP (401|403|429|451|503)/.test(m);
          saveText(db, a.id, blocked ? "blocked" : "failed");
          if (blocked) out.blocked++;
        }
      }
    }),
  );
  // Google News items that were checked before their direct twin arrived get another look.
  for (const r of db.prepare("SELECT id, url, title, cluster_id, publisher FROM articles WHERE text_status = 'headline' AND fetched_at >= datetime('now', '-2 days') LIMIT 200").all() as Row[]) {
    const twin = directTwin(db, r);
    if (twin?.full_text) saveText(db, r.id, "full", twin.full_text, twin.url);
  }
  return out;
}

/** Text the Mac helper fetched for an article this server was refused. */
export function saveHelperPage(db: DB, articleId: string, html: string) {
  const text = articleText(html);
  saveText(db, articleId, text.length >= FULL ? "full" : text.length >= 300 ? "summary" : "failed", text.length >= 300 ? text : null);
}
