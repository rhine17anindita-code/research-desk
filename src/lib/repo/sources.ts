import type { DB } from "../db";
import { newId, nowIso } from "../ids";
import type { Source, SourceKind } from "../types";
import { indexItem } from "./search-index";
import { canonicalUrl } from "../text";
import { getArticle } from "./stories";

interface SourceRow {
  id: string; kind: SourceKind; title: string; authors: string | null; publisher: string | null; published_at: string | null; url: string | null;
  doi: string | null; excerpt: string | null; retrieved_at: string; provider: string; article_id: string | null; notes: string | null; saved: number;
  created_at: string; status?: Source["status"]; found_by?: string | null;
}

export function mapSource(r: SourceRow): Source {
  return {
    id: r.id, kind: r.kind, title: r.title, authors: r.authors, publisher: r.publisher, publishedAt: r.published_at, url: r.url, doi: r.doi,
    excerpt: r.excerpt, retrievedAt: r.retrieved_at, provider: r.provider, articleId: r.article_id, notes: r.notes, saved: !!r.saved,
    createdAt: r.created_at, status: r.status, foundBy: r.found_by,
  };
}

export interface SourceInput {
  kind: SourceKind;
  title: string;
  authors?: string | null;
  publisher?: string | null;
  publishedAt?: string | null;
  url?: string | null;
  doi?: string | null;
  excerpt?: string | null;
  provider: string;
  articleId?: string | null;
  notes?: string | null;
  saved?: boolean;
}

/** Insert or reuse a source record (deduplicated by canonical URL). Metadata comes only from the caller's retrieval — never invented. */
export function upsertSource(db: DB, input: SourceInput): Source {
  const url = input.url ? canonicalUrl(input.url) : null;
  if (url) {
    const existing = db.prepare("SELECT * FROM sources WHERE url = ?").get(url) as SourceRow | undefined;
    if (existing) {
      if (input.saved && !existing.saved) db.prepare("UPDATE sources SET saved = 1, updated_at = ? WHERE id = ?").run(nowIso(), existing.id);
      if (!existing.excerpt && input.excerpt) db.prepare("UPDATE sources SET excerpt = ?, updated_at = ? WHERE id = ?").run(input.excerpt, nowIso(), existing.id);
      return getSource(db, existing.id)!;
    }
  }
  const id = newId("src");
  const now = nowIso();
  db.prepare(
    `INSERT INTO sources (id, kind, title, authors, publisher, published_at, url, doi, excerpt, retrieved_at, provider, article_id, notes, saved, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, input.kind, input.title.slice(0, 500), input.authors ?? null, input.publisher ?? null, input.publishedAt ?? null, url, input.doi ?? null,
    input.excerpt ?? null, now, input.provider, input.articleId ?? null, input.notes ?? null, input.saved ? 1 : 0, now, now,
  );
  indexItem(db, "source", id, input.title, `${input.excerpt ?? ""} ${input.authors ?? ""} ${input.publisher ?? ""} ${input.notes ?? ""}`);
  return getSource(db, id)!;
}

/** Every ingested article can act as a source; create its record on first use. */
export function sourceForArticle(db: DB, articleId: string): Source | null {
  const existing = db.prepare("SELECT * FROM sources WHERE article_id = ?").get(articleId) as SourceRow | undefined;
  if (existing) return mapSource(existing);
  const a = getArticle(db, articleId);
  if (!a) return null;
  return upsertSource(db, {
    kind: "news", title: a.title, authors: a.author, publisher: a.publisher, publishedAt: a.publishedAt, url: a.url,
    excerpt: a.summary, provider: "feed", articleId: a.id,
  });
}

export function getSource(db: DB, id: string): Source | null {
  const r = db.prepare("SELECT * FROM sources WHERE id = ?").get(id) as SourceRow | undefined;
  return r ? mapSource(r) : null;
}

export function getSources(db: DB, ids: string[]): Source[] {
  if (!ids.length) return [];
  return (db.prepare(`SELECT * FROM sources WHERE id IN (${ids.map(() => "?").join(",")})`).all(...ids) as SourceRow[]).map(mapSource);
}

export function updateSource(db: DB, id: string, patch: Partial<SourceInput>): Source | null {
  const cur = getSource(db, id);
  if (!cur) return null;
  const next = { ...cur, ...patch };
  db.prepare(
    `UPDATE sources SET kind = ?, title = ?, authors = ?, publisher = ?, published_at = ?, url = ?, doi = ?, excerpt = ?, notes = ?, saved = ?, updated_at = ? WHERE id = ?`,
  ).run(next.kind, next.title, next.authors, next.publisher, next.publishedAt, next.url, next.doi, next.excerpt, next.notes, next.saved ? 1 : 0, nowIso(), id);
  indexItem(db, "source", id, next.title, `${next.excerpt ?? ""} ${next.authors ?? ""} ${next.publisher ?? ""} ${next.notes ?? ""}`);
  return getSource(db, id);
}

export function deleteSource(db: DB, id: string): void {
  db.prepare("DELETE FROM sources WHERE id = ?").run(id);
  db.prepare("DELETE FROM search_index WHERE kind = 'source' AND ref_id = ?").run(id);
  db.prepare("DELETE FROM links WHERE (from_type = 'source' AND from_id = ?) OR (to_type = 'source' AND to_id = ?)").run(id, id);
}

export function listLibrary(db: DB, opts: { kind?: string; provider?: string; q?: string; savedOnly?: boolean; limit?: number } = {}): (Source & { usedBy: number })[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.savedOnly !== false) where.push("(s.saved = 1 OR EXISTS (SELECT 1 FROM question_sources qs WHERE qs.source_id = s.id AND qs.status = 'attached') OR EXISTS (SELECT 1 FROM evidence e WHERE e.source_id = s.id))");
  if (opts.kind) { where.push("s.kind = ?"); params.push(opts.kind); }
  if (opts.provider) { where.push("s.provider = ?"); params.push(opts.provider); }
  if (opts.q) {
    const terms = (opts.q.match(/[\p{L}\p{N}]+/gu) ?? []).map((t) => `"${t}"*`).join(" AND ");
    if (terms) { where.push("s.id IN (SELECT ref_id FROM search_index WHERE kind = 'source' AND search_index MATCH ?)"); params.push(terms); }
  }
  const rows = db
    .prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM question_sources qs WHERE qs.source_id = s.id AND qs.status = 'attached') + (SELECT COUNT(*) FROM evidence e WHERE e.source_id = s.id) AS used_by
       FROM sources s ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY s.created_at DESC LIMIT ?`,
    )
    .all(...params, opts.limit ?? 300) as (SourceRow & { used_by: number })[];
  return rows.map((r) => ({ ...mapSource(r), usedBy: r.used_by }));
}

// ---- Question ↔ source association ---------------------------------------

export function linkQuestionSource(db: DB, questionId: string, sourceId: string, status: "candidate" | "attached" | "rejected", foundBy?: string): void {
  db.prepare(
    `INSERT INTO question_sources (question_id, source_id, status, found_by, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(question_id, source_id) DO UPDATE SET status = CASE WHEN question_sources.status = 'attached' AND excluded.status = 'candidate' THEN 'attached' ELSE excluded.status END`,
  ).run(questionId, sourceId, status, foundBy ?? null, nowIso());
}

export function questionSources(db: DB, questionId: string, statuses: string[] = ["candidate", "attached"]): Source[] {
  return (
    db
      .prepare(
        `SELECT s.*, qs.status, qs.found_by FROM question_sources qs JOIN sources s ON s.id = qs.source_id
         WHERE qs.question_id = ? AND qs.status IN (${statuses.map(() => "?").join(",")})
         ORDER BY CASE qs.status WHEN 'attached' THEN 0 ELSE 1 END, qs.created_at ASC`,
      )
      .all(questionId, ...statuses) as SourceRow[]
  ).map(mapSource);
}

/** Where a source is used: questions it is attached to, answers it backs, stories it came from. */
export function sourceUsage(db: DB, sourceId: string) {
  const questions = db
    .prepare(`SELECT q.id, q.text, q.cluster_id, qs.status FROM question_sources qs JOIN questions q ON q.id = qs.question_id WHERE qs.source_id = ? AND qs.status != 'rejected'`)
    .all(sourceId) as { id: string; text: string; cluster_id: string | null; status: string }[];
  const evidence = db
    .prepare(`SELECT e.claim, e.relation, a.id AS answer_id, q.id AS question_id, q.text AS question FROM evidence e JOIN answers a ON a.id = e.answer_id JOIN questions q ON q.id = a.question_id WHERE e.source_id = ?`)
    .all(sourceId) as { claim: string; relation: string; answer_id: string; question_id: string; question: string }[];
  return { questions, evidence };
}
