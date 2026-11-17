import type { DB } from "./db";
import { nowIso } from "./ids";
import { activeChannelId } from "./channels";
import { recordEdit } from "./voice";

/**
 * Production layer on top of research projects: every project is also a content item
 * with a type, a production stage, a publish date and its working documents.
 */

export * from "./production-shared";
import { DOC_KEYS, PLATFORMS, PROD_STAGES, progressOf, type ContentType, type ProdStage, type Production, type ProductionDocs } from "./production-shared";

interface Row {
  id: string; title: string; content_type: string; production_stage: string; publish_date: string | null; platforms: string; series_name: string | null;
  guest: string | null; sponsor: string | null; published_url: string | null; production: string; updated_at: string;
}

const parse = <T,>(s: string | null, d: T): T => {
  try {
    return s ? (JSON.parse(s) as T) : d;
  } catch {
    return d;
  }
};

const map = (r: Row): Production => {
  const docs = parse<ProductionDocs>(r.production, {});
  return {
    projectId: r.id, title: r.title, contentType: (r.content_type || "video") as ContentType, stage: (r.production_stage || "idea") as ProdStage,
    publishDate: r.publish_date, platforms: parse<string[]>(r.platforms, []), seriesName: r.series_name, guest: r.guest, sponsor: r.sponsor,
    publishedUrl: r.published_url, docs, progress: progressOf(r.production_stage, docs), updatedAt: r.updated_at,
  };
};

const COLS = "id, title, content_type, production_stage, publish_date, platforms, series_name, guest, sponsor, published_url, production, updated_at";

export function getProduction(db: DB, projectId: string): Production | null {
  const r = db.prepare(`SELECT ${COLS} FROM projects WHERE id = ?`).get(projectId) as Row | undefined;
  return r ? map(r) : null;
}

export type ProductionPatch = Partial<Pick<Production, "contentType" | "stage" | "publishDate" | "platforms" | "seriesName" | "guest" | "sponsor" | "publishedUrl">> & { docs?: ProductionDocs };

export function updateProduction(db: DB, projectId: string, patch: ProductionPatch): Production | null {
  const cur = getProduction(db, projectId);
  if (!cur) return null;
  const n = { ...cur, ...patch, docs: { ...cur.docs, ...(patch.docs ?? {}) } };
  // You edited an AI draft: remember the change so future drafts learn from it.
  if (patch.docs?.script !== undefined && !("script_ai" in (patch.docs ?? {})) && cur.docs.script_ai && patch.docs.script !== cur.docs.script) {
    recordEdit(db, projectId, cur.docs.script_ai, patch.docs.script);
  }
  const date = n.publishDate && /^\d{4}-\d{2}-\d{2}$/.test(n.publishDate) ? n.publishDate : null;
  db.prepare(
    `UPDATE projects SET content_type = ?, production_stage = ?, publish_date = ?, platforms = ?, series_name = ?, guest = ?, sponsor = ?, published_url = ?, production = ?, updated_at = ? WHERE id = ?`,
  ).run(
    n.contentType, n.stage, date, JSON.stringify(n.platforms.filter((p) => (PLATFORMS as readonly string[]).includes(p))), n.seriesName || null, n.guest || null,
    n.sponsor || null, n.publishedUrl || null, JSON.stringify(n.docs), nowIso(), projectId,
  );
  return getProduction(db, projectId);
}

/** Every content item of the active channel (archived research excluded). */
export function listProductions(db: DB): Production[] {
  return (db.prepare(`SELECT ${COLS} FROM projects WHERE (channel_id = ? OR channel_id IS NULL) AND stage != 'archived' ORDER BY COALESCE(publish_date, '9999'), updated_at DESC`).all(activeChannelId(db)) as Row[]).map(map);
}
