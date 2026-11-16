import type { DB } from "../db";
import { ftsQuery } from "../text";
import type { SearchKind } from "./search-index";

export interface SearchHit {
  kind: SearchKind;
  id: string;
  title: string;
  snippet: string;
  date: string | null;
  meta: string | null;
  href: string;
  rank: number;
}

export interface SearchFilters {
  kinds?: SearchKind[];
  from?: string;
  to?: string;
  sourceKind?: string;
  publisher?: string;
  projectId?: string;
  answerState?: string;
  limit?: number;
}

/** Unified local full-text search across every research object. No network, no AI. */
export function searchAll(db: DB, q: string, f: SearchFilters = {}): SearchHit[] {
  const match = ftsQuery(q, "all");
  if (!match) return [];
  const kinds = f.kinds?.length ? f.kinds : null;
  let rows = db
    .prepare(
      `SELECT kind, ref_id, title, snippet(search_index, 3, '[[', ']]', '…', 18) AS snip, bm25(search_index, 0, 0, 3.0, 1.0) AS rank
       FROM search_index WHERE search_index MATCH ? ${kinds ? `AND kind IN (${kinds.map(() => "?").join(",")})` : ""}
       ORDER BY rank LIMIT 400`,
    )
    .all(match, ...(kinds ?? [])) as { kind: SearchKind; ref_id: string; title: string; snip: string; rank: number }[];
  // Fall back to OR-matching when the strict query finds nothing.
  if (!rows.length) {
    const any = ftsQuery(q, "any");
    if (any)
      rows = db
        .prepare(
          `SELECT kind, ref_id, title, snippet(search_index, 3, '[[', ']]', '…', 18) AS snip, bm25(search_index, 0, 0, 3.0, 1.0) AS rank
           FROM search_index WHERE search_index MATCH ? ${kinds ? `AND kind IN (${kinds.map(() => "?").join(",")})` : ""} ORDER BY rank LIMIT 200`,
        )
        .all(any, ...(kinds ?? [])) as typeof rows;
  }

  const hits: SearchHit[] = [];
  for (const r of rows) {
    const h = resolve(db, r.kind, r.ref_id, f);
    if (!h) continue;
    if (f.from && h.date && h.date < f.from) continue;
    if (f.to && h.date && h.date > f.to + "T23:59:59") continue;
    hits.push({ kind: r.kind, id: r.ref_id, title: r.title || h.title, snippet: r.snip, date: h.date, meta: h.meta, href: h.href, rank: r.rank });
    if (hits.length >= (f.limit ?? 120)) break;
  }
  return hits;
}

function resolve(db: DB, kind: SearchKind, id: string, f: SearchFilters): { title: string; date: string | null; meta: string | null; href: string } | null {
  const inProject = (type: string) =>
    !f.projectId || !!db.prepare("SELECT 1 FROM project_items WHERE project_id = ? AND item_type = ? AND item_id = ?").get(f.projectId, type, id);
  switch (kind) {
    case "cluster": {
      const r = db.prepare("SELECT headline, last_updated_at, source_count FROM clusters WHERE id = ?").get(id) as { headline: string; last_updated_at: string; source_count: number } | undefined;
      if (!r || !inProject("cluster")) return null;
      if (f.publisher && !db.prepare("SELECT 1 FROM articles WHERE cluster_id = ? AND publisher = ?").get(id, f.publisher)) return null;
      return { title: r.headline, date: r.last_updated_at, meta: `${r.source_count} source${r.source_count === 1 ? "" : "s"}`, href: `/story/${id}` };
    }
    case "article": {
      const r = db.prepare("SELECT title, publisher, published_at, cluster_id FROM articles WHERE id = ?").get(id) as { title: string; publisher: string | null; published_at: string | null; cluster_id: string | null } | undefined;
      if (!r || f.projectId) return null;
      if (f.publisher && r.publisher !== f.publisher) return null;
      return { title: r.title, date: r.published_at, meta: r.publisher, href: r.cluster_id ? `/story/${r.cluster_id}` : "/library?tab=articles" };
    }
    case "question": {
      const r = db.prepare("SELECT text, answer_state, updated_at, project_id FROM questions WHERE id = ? AND archived = 0").get(id) as { text: string; answer_state: string; updated_at: string; project_id: string | null } | undefined;
      if (!r) return null;
      if (f.answerState && r.answer_state !== f.answerState) return null;
      if (f.projectId && r.project_id !== f.projectId && !inProject("question")) return null;
      return { title: r.text, date: r.updated_at, meta: r.answer_state, href: `/question/${id}` };
    }
    case "answer": {
      const r = db.prepare("SELECT a.summary, a.created_at, a.question_id, a.state, a.level FROM answers a WHERE a.id = ?").get(id) as { summary: string; created_at: string; question_id: string; state: string; level: number } | undefined;
      if (!r) return null;
      if (f.answerState && r.state !== f.answerState) return null;
      return { title: r.summary, date: r.created_at, meta: `Level ${r.level} answer · ${r.state}`, href: `/question/${r.question_id}` };
    }
    case "source": {
      const r = db.prepare("SELECT title, kind, publisher, published_at, created_at FROM sources WHERE id = ?").get(id) as { title: string; kind: string; publisher: string | null; published_at: string | null; created_at: string } | undefined;
      if (!r || !inProject("source")) return null;
      if (f.sourceKind && r.kind !== f.sourceKind) return null;
      if (f.publisher && r.publisher !== f.publisher) return null;
      return { title: r.title, date: r.published_at ?? r.created_at, meta: [r.kind, r.publisher].filter(Boolean).join(" · "), href: `/library/source/${id}` };
    }
    case "note": {
      const r = db.prepare("SELECT title, body, updated_at, project_id, cluster_id, question_id FROM notes WHERE id = ?").get(id) as { title: string | null; body: string; updated_at: string; project_id: string | null; cluster_id: string | null; question_id: string | null } | undefined;
      if (!r) return null;
      if (f.projectId && r.project_id !== f.projectId) return null;
      const href = r.project_id ? `/research/${r.project_id}` : r.question_id ? `/question/${r.question_id}` : r.cluster_id ? `/story/${r.cluster_id}` : `/library?tab=notes`;
      return { title: r.title || r.body.slice(0, 100), date: r.updated_at, meta: "Note", href };
    }
    case "project": {
      const r = db.prepare("SELECT title, stage, updated_at FROM projects WHERE id = ?").get(id) as { title: string; stage: string; updated_at: string } | undefined;
      if (!r || (f.projectId && f.projectId !== id)) return null;
      return { title: r.title, date: r.updated_at, meta: r.stage, href: `/research/${id}` };
    }
  }
  return null;
}
