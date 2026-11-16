import type { DB } from "../db";
import { newId, nowIso } from "../ids";
import type { Link, ObjectType } from "../types";

interface LinkRow { id: string; from_type: ObjectType; from_id: string; to_type: ObjectType; to_id: string; relation: string; note: string | null; origin: string; created_at: string }

export function createLink(db: DB, l: { fromType: ObjectType; fromId: string; toType: ObjectType; toId: string; relation: string; note?: string | null; origin?: string }): Link {
  if (l.fromType === l.toType && l.fromId === l.toId) throw new Error("An item cannot be linked to itself");
  const id = newId("lnk");
  db.prepare(
    `INSERT INTO links (id, from_type, from_id, to_type, to_id, relation, note, origin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(from_type, from_id, to_type, to_id, relation) DO UPDATE SET note = COALESCE(excluded.note, links.note)`,
  ).run(id, l.fromType, l.fromId, l.toType, l.toId, l.relation, l.note ?? null, l.origin ?? "user", nowIso());
  const row = db.prepare("SELECT * FROM links WHERE from_type = ? AND from_id = ? AND to_type = ? AND to_id = ? AND relation = ?").get(l.fromType, l.fromId, l.toType, l.toId, l.relation) as LinkRow;
  return mapLink(row);
}

function mapLink(r: LinkRow): Link {
  return { id: r.id, fromType: r.from_type, fromId: r.from_id, toType: r.to_type, toId: r.to_id, relation: r.relation, note: r.note, origin: r.origin, createdAt: r.created_at };
}

export function deleteLink(db: DB, id: string): void {
  db.prepare("DELETE FROM links WHERE id = ?").run(id);
}

/** Title lookup for any object, so links can be rendered without the caller knowing the type. */
export function objectTitle(db: DB, type: ObjectType, id: string): string | null {
  const q: Record<ObjectType, string> = {
    cluster: "SELECT headline AS t FROM clusters WHERE id = ?",
    question: "SELECT text AS t FROM questions WHERE id = ?",
    answer: "SELECT summary AS t FROM answers WHERE id = ?",
    source: "SELECT title AS t FROM sources WHERE id = ?",
    project: "SELECT title AS t FROM projects WHERE id = ?",
    note: "SELECT COALESCE(title, substr(body, 1, 120)) AS t FROM notes WHERE id = ?",
    article: "SELECT title AS t FROM articles WHERE id = ?",
  };
  const r = db.prepare(q[type]).get(id) as { t: string } | undefined;
  return r?.t ?? null;
}

/** All links touching an object, both directions, with the other end resolved. */
export function linksFor(db: DB, type: ObjectType, id: string): Link[] {
  const rows = db.prepare("SELECT * FROM links WHERE (from_type = ? AND from_id = ?) OR (to_type = ? AND to_id = ?) ORDER BY created_at DESC").all(type, id, type, id) as LinkRow[];
  return rows
    .map((r) => {
      const l = mapLink(r);
      const out = r.from_type === type && r.from_id === id;
      const otherType = out ? r.to_type : r.from_type;
      const otherId = out ? r.to_id : r.from_id;
      return { ...l, direction: out ? ("out" as const) : ("in" as const), otherType, otherId, otherTitle: objectTitle(db, otherType, otherId) ?? "(deleted item)" };
    });
}

export function hrefFor(type: ObjectType, id: string, extra?: { clusterId?: string | null }): string {
  switch (type) {
    case "cluster": return `/story/${id}`;
    case "question": return `/question/${id}`;
    case "answer": return `/question/${id}`;
    case "source": return `/library/source/${id}`;
    case "project": return `/research/${id}`;
    case "note": return extra?.clusterId ? `/story/${extra.clusterId}` : `/library?tab=notes#${id}`;
    case "article": return `/library?tab=articles`;
  }
}
