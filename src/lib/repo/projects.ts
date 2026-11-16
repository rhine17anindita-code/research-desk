import type { DB } from "../db";
import { newId, nowIso } from "../ids";
import type { Note, Project } from "../types";
import { indexItem, unindexItem } from "./search-index";

interface ProjectRow { id: string; title: string; thesis: string | null; description: string | null; stage: string; angles: string | null; gaps: string | null; created_at: string; updated_at: string }

const mapProject = (r: ProjectRow): Project => ({
  id: r.id, title: r.title, thesis: r.thesis, description: r.description, stage: r.stage, angles: r.angles, gaps: r.gaps, createdAt: r.created_at, updatedAt: r.updated_at,
});

function reindexProject(db: DB, p: Project) {
  indexItem(db, "project", p.id, p.title, [p.thesis, p.description, p.angles, p.gaps].filter(Boolean).join(" "));
}

export function createProject(db: DB, input: { title: string; thesis?: string | null; description?: string | null; stage?: string }): Project {
  const id = newId("prj");
  const now = nowIso();
  db.prepare("INSERT INTO projects (id, title, thesis, description, stage, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    id, input.title.trim(), input.thesis ?? null, input.description ?? null, input.stage ?? "investigating", now, now,
  );
  const p = getProject(db, id)!;
  reindexProject(db, p);
  return p;
}

export function getProject(db: DB, id: string): Project | null {
  const r = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as ProjectRow | undefined;
  return r ? mapProject(r) : null;
}

export function listProjects(db: DB): (Project & { counts: Record<string, number> })[] {
  const rows = db.prepare("SELECT * FROM projects ORDER BY updated_at DESC").all() as ProjectRow[];
  const cnt = db.prepare("SELECT item_type, COUNT(*) AS n FROM project_items WHERE project_id = ? GROUP BY item_type");
  const notes = db.prepare("SELECT COUNT(*) AS n FROM notes WHERE project_id = ?");
  return rows.map((r) => {
    const counts: Record<string, number> = {};
    for (const c of cnt.all(r.id) as { item_type: string; n: number }[]) counts[c.item_type] = c.n;
    counts.note = (notes.get(r.id) as { n: number }).n;
    return { ...mapProject(r), counts };
  });
}

export function updateProject(db: DB, id: string, patch: Partial<Omit<Project, "id" | "createdAt" | "updatedAt">>): Project | null {
  const cur = getProject(db, id);
  if (!cur) return null;
  const n = { ...cur, ...patch };
  db.prepare("UPDATE projects SET title = ?, thesis = ?, description = ?, stage = ?, angles = ?, gaps = ?, updated_at = ? WHERE id = ?").run(
    n.title, n.thesis, n.description, n.stage, n.angles, n.gaps, nowIso(), id,
  );
  const p = getProject(db, id)!;
  reindexProject(db, p);
  return p;
}

export function deleteProject(db: DB, id: string): void {
  db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  unindexItem(db, "project", id);
}

export type ProjectItemType = "cluster" | "question" | "source";

export function addToProject(db: DB, projectId: string, itemType: ProjectItemType, itemId: string, note?: string): void {
  db.prepare("INSERT OR IGNORE INTO project_items (project_id, item_type, item_id, note, added_at) VALUES (?, ?, ?, ?, ?)").run(projectId, itemType, itemId, note ?? null, nowIso());
  db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(nowIso(), projectId);
  if (itemType === "cluster") {
    // Saving into a project is a strong "this matters" signal.
    db.prepare("UPDATE clusters SET state = 'saved' WHERE id = ? AND state = 'new'").run(itemId);
  }
}

export function removeFromProject(db: DB, projectId: string, itemType: string, itemId: string): void {
  db.prepare("DELETE FROM project_items WHERE project_id = ? AND item_type = ? AND item_id = ?").run(projectId, itemType, itemId);
}

export function projectItemIds(db: DB, projectId: string, itemType: ProjectItemType): string[] {
  return (db.prepare("SELECT item_id FROM project_items WHERE project_id = ? AND item_type = ? ORDER BY added_at ASC").all(projectId, itemType) as { item_id: string }[]).map((r) => r.item_id);
}

export function projectsContaining(db: DB, itemType: ProjectItemType, itemId: string): Project[] {
  return (db.prepare("SELECT p.* FROM projects p JOIN project_items i ON i.project_id = p.id WHERE i.item_type = ? AND i.item_id = ?").all(itemType, itemId) as ProjectRow[]).map(mapProject);
}

// ---- Notes -----------------------------------------------------------------

interface NoteRow { id: string; project_id: string | null; cluster_id: string | null; question_id: string | null; title: string | null; body: string; origin: Note["origin"]; created_at: string; updated_at: string }
const mapNote = (r: NoteRow): Note => ({
  id: r.id, projectId: r.project_id, clusterId: r.cluster_id, questionId: r.question_id, title: r.title, body: r.body, origin: r.origin, createdAt: r.created_at, updatedAt: r.updated_at,
});

export function createNote(db: DB, input: { projectId?: string | null; clusterId?: string | null; questionId?: string | null; title?: string | null; body: string; origin?: Note["origin"] }): Note {
  const id = newId("note");
  const now = nowIso();
  db.prepare("INSERT INTO notes (id, project_id, cluster_id, question_id, title, body, origin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    id, input.projectId ?? null, input.clusterId ?? null, input.questionId ?? null, input.title ?? null, input.body, input.origin ?? "user", now, now,
  );
  indexItem(db, "note", id, input.title ?? "", input.body);
  if (input.projectId) db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(now, input.projectId);
  return getNote(db, id)!;
}

export function getNote(db: DB, id: string): Note | null {
  const r = db.prepare("SELECT * FROM notes WHERE id = ?").get(id) as NoteRow | undefined;
  return r ? mapNote(r) : null;
}

export function listNotes(db: DB, opts: { projectId?: string; clusterId?: string; questionId?: string; all?: boolean }): Note[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.projectId) { where.push("project_id = ?"); params.push(opts.projectId); }
  if (opts.clusterId) { where.push("cluster_id = ?"); params.push(opts.clusterId); }
  if (opts.questionId) { where.push("question_id = ?"); params.push(opts.questionId); }
  if (!where.length && !opts.all) return [];
  return (db.prepare(`SELECT * FROM notes ${where.length ? "WHERE " + where.join(" OR ") : ""} ORDER BY updated_at DESC`).all(...params) as NoteRow[]).map(mapNote);
}

export function updateNote(db: DB, id: string, patch: Partial<Pick<Note, "title" | "body" | "projectId">>): Note | null {
  const cur = getNote(db, id);
  if (!cur) return null;
  const n = { ...cur, ...patch };
  db.prepare("UPDATE notes SET title = ?, body = ?, project_id = ?, updated_at = ? WHERE id = ?").run(n.title, n.body, n.projectId, nowIso(), id);
  indexItem(db, "note", id, n.title ?? "", n.body);
  return getNote(db, id);
}

export function deleteNote(db: DB, id: string): void {
  db.prepare("DELETE FROM notes WHERE id = ?").run(id);
  unindexItem(db, "note", id);
}
