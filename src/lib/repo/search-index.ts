import type { DB } from "../db";

export type SearchKind = "cluster" | "article" | "question" | "answer" | "source" | "note" | "project";

/** Upsert one object into the unified full-text index. */
export function indexItem(db: DB, kind: SearchKind, refId: string, title: string, body: string): void {
  db.prepare("DELETE FROM search_index WHERE kind = ? AND ref_id = ?").run(kind, refId);
  db.prepare("INSERT INTO search_index (kind, ref_id, title, body) VALUES (?, ?, ?, ?)").run(kind, refId, title ?? "", body ?? "");
}

export function unindexItem(db: DB, kind: SearchKind, refId: string): void {
  db.prepare("DELETE FROM search_index WHERE kind = ? AND ref_id = ?").run(kind, refId);
}
