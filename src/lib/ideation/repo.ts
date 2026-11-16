import type { DB } from "../db";
import { parseJson } from "../db";
import { newId, nowIso } from "../ids";
import { indexItem, unindexItem } from "../repo/search-index";
import { uniqueTokens } from "../text";
import { FORMAT_BY_ID } from "./formats";
import { activeChannelId } from "../channels";

// ---------------------------------------------------------------------------
// Ideas
// ---------------------------------------------------------------------------

export type IdeaStatus = "new" | "saved" | "skipped" | "developing" | "made" | "dropped";

export interface IdeaBacking {
  clusters: string[];
  sources: string[];
  questions: string[];
}

export interface Idea {
  id: string;
  title: string;
  hook: string | null;
  angle: string | null;
  whyUntold: string | null;
  whyItLands: string | null;
  format: string;
  medium: "visual" | "written";
  angleType: string | null;
  backing: IdeaBacking;
  openQuestions: string[];
  effort: string | null;
  timeliness: string | null;
  status: IdeaStatus;
  reason: string | null;
  origin: "ai" | "user";
  batchId: string | null;
  projectId: string | null;
  inspirationId: string | null;
  packaging: IdeaPackaging | null;
  expansion: IdeaExpansion | null;
  proposal: string | null;
  pitch: string | null;
  sourceKind: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IdeaPackaging {
  titles: string[];
  thumbnail: string;
  firstSeconds: string;
  scores: { hook: number; massAppeal: number; novelty: number; evidence: number };
  whoShares?: string;
}

export interface IdeaExpansion {
  logline: string;
  angles: { title: string; angle: string; hook: string }[];
  outline: { heading: string; beats: string[] }[];
  nextSteps: string[];
  toLookAt: { what: string; why: string; where: string }[];
  people: string[];
  risks: string[];
  relatedStories: string[];
  model: string;
  generatedAt: string;
}

interface IdeaRow {
  id: string; title: string; hook: string | null; angle: string | null; why_untold: string | null; why_it_lands: string | null; format: string;
  medium: Idea["medium"]; angle_type: string | null; backing: string; open_questions: string; effort: string | null; timeliness: string | null;
  status: IdeaStatus; reason: string | null; origin: Idea["origin"]; batch_id: string | null; project_id: string | null; inspiration_id: string | null;
  packaging: string | null; expansion: string | null; proposal: string | null; pitch: string | null; source_kind: string | null;
  created_at: string; updated_at: string;
}

const mapIdea = (r: IdeaRow): Idea => ({
  id: r.id, title: r.title, hook: r.hook, angle: r.angle, whyUntold: r.why_untold, whyItLands: r.why_it_lands, format: r.format, medium: r.medium,
  angleType: r.angle_type, backing: parseJson(r.backing, { clusters: [], sources: [], questions: [] }), openQuestions: parseJson(r.open_questions, []),
  effort: r.effort, timeliness: r.timeliness, status: r.status, reason: r.reason, origin: r.origin, batchId: r.batch_id, projectId: r.project_id,
  inspirationId: r.inspiration_id, packaging: parseJson(r.packaging, null), expansion: parseJson(r.expansion, null), proposal: r.proposal, pitch: r.pitch,
  sourceKind: r.source_kind, createdAt: r.created_at, updatedAt: r.updated_at,
});

export type IdeaInput = Omit<Idea, "id" | "status" | "reason" | "projectId" | "createdAt" | "updatedAt" | "medium" | "packaging" | "expansion" | "proposal" | "pitch" | "sourceKind"> & {
  medium?: Idea["medium"];
  packaging?: IdeaPackaging | null;
  pitch?: string | null;
  sourceKind?: string | null;
};

export function setIdeaExtras(db: DB, id: string, extras: { expansion?: IdeaExpansion; proposal?: string; packaging?: IdeaPackaging }): Idea | null {
  if (extras.expansion) db.prepare("UPDATE ideas SET expansion = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(extras.expansion), nowIso(), id);
  if (extras.proposal !== undefined) db.prepare("UPDATE ideas SET proposal = ?, updated_at = ? WHERE id = ?").run(extras.proposal, nowIso(), id);
  if (extras.packaging) db.prepare("UPDATE ideas SET packaging = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(extras.packaging), nowIso(), id);
  return getIdea(db, id);
}

export function createIdea(db: DB, i: IdeaInput): Idea {
  const id = newId("idea");
  const now = nowIso();
  const medium = i.medium ?? FORMAT_BY_ID[i.format]?.medium ?? "visual";
  db.prepare(
    `INSERT INTO ideas (id, title, hook, angle, why_untold, why_it_lands, format, medium, angle_type, backing, open_questions, effort, timeliness,
      status, origin, batch_id, inspiration_id, channel_id, packaging, source_kind, pitch, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, i.title.trim(), i.hook, i.angle, i.whyUntold, i.whyItLands, i.format, medium, i.angleType, JSON.stringify(i.backing), JSON.stringify(i.openQuestions),
    i.effort, i.timeliness, i.origin, i.batchId, i.inspirationId, activeChannelId(db), i.packaging ? JSON.stringify(i.packaging) : null, i.sourceKind ?? null,
    i.pitch ?? null, now, now,
  );
  indexItem(db, "idea", id, i.title, [i.hook, i.angle, i.whyUntold, i.whyItLands, ...i.openQuestions].filter(Boolean).join(" "));
  return getIdea(db, id)!;
}

export function getIdea(db: DB, id: string): Idea | null {
  const r = db.prepare("SELECT * FROM ideas WHERE id = ?").get(id) as IdeaRow | undefined;
  return r ? mapIdea(r) : null;
}

export function listIdeas(db: DB, opts: { status?: IdeaStatus | IdeaStatus[]; format?: string; medium?: string; limit?: number; inspirationId?: string; origin?: string } = {}): Idea[] {
  const where: string[] = ["channel_id = ?"];
  const params: unknown[] = [activeChannelId(db)];
  if (opts.inspirationId) { where.push("inspiration_id = ?"); params.push(opts.inspirationId); }
  if (opts.origin) { where.push("origin = ?"); params.push(opts.origin); }
  if (opts.status) {
    const st = Array.isArray(opts.status) ? opts.status : [opts.status];
    where.push(`status IN (${st.map(() => "?").join(",")})`);
    params.push(...st);
  }
  if (opts.format) { where.push("format = ?"); params.push(opts.format); }
  if (opts.medium) { where.push("medium = ?"); params.push(opts.medium); }
  return (db.prepare(`SELECT * FROM ideas WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT ?`).all(...params, opts.limit ?? 200) as IdeaRow[]).map(mapIdea);
}

export function updateIdea(db: DB, id: string, patch: Partial<Pick<Idea, "status" | "reason" | "projectId" | "title" | "hook" | "angle" | "format">>): Idea | null {
  const cur = getIdea(db, id);
  if (!cur) return null;
  const n = { ...cur, ...patch };
  db.prepare("UPDATE ideas SET status = ?, reason = ?, project_id = ?, title = ?, hook = ?, angle = ?, format = ?, updated_at = ? WHERE id = ?").run(
    n.status, n.reason, n.projectId, n.title, n.hook, n.angle, n.format, nowIso(), id,
  );
  return getIdea(db, id);
}

export function deleteIdea(db: DB, id: string): void {
  db.prepare("DELETE FROM ideas WHERE id = ?").run(id);
  unindexItem(db, "idea", id);
}

export function ideaCounts(db: DB): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of db.prepare("SELECT status, COUNT(*) AS n FROM ideas WHERE channel_id = ? GROUP BY status").all(activeChannelId(db)) as { status: string; n: number }[]) out[r.status] = r.n;
  return out;
}

// ---------------------------------------------------------------------------
// Inspirations
// ---------------------------------------------------------------------------

export type InspirationIntent = "recreate-format" | "cover-topic" | "dig-deeper" | "other-angles";

export interface InspirationAnalysis {
  topic: string;
  format: string;
  hookStyle: string;
  whyItWorks: string;
  angleType: string;
  patterns: string[];
  model: string;
  generatedAt: string;
}

export interface Inspiration {
  id: string;
  url: string | null;
  kind: string;
  title: string | null;
  author: string | null;
  description: string | null;
  thumbnail: string | null;
  note: string | null;
  intents: InspirationIntent[];
  analysis: InspirationAnalysis | null;
  matchedClusters: string[];
  createdAt: string;
}

interface InspirationRow {
  id: string; url: string | null; kind: string; title: string | null; author: string | null; description: string | null; thumbnail: string | null;
  note: string | null; intents: string; analysis: string | null; matched_clusters: string; created_at: string;
}

const mapInspiration = (r: InspirationRow): Inspiration => ({
  id: r.id, url: r.url, kind: r.kind, title: r.title, author: r.author, description: r.description, thumbnail: r.thumbnail, note: r.note,
  intents: parseJson(r.intents, []), analysis: parseJson(r.analysis, null), matchedClusters: parseJson(r.matched_clusters, []), createdAt: r.created_at,
});

export function createInspiration(db: DB, i: Omit<Inspiration, "id" | "analysis" | "createdAt">): Inspiration {
  const id = newId("insp");
  const now = nowIso();
  db.prepare(
    `INSERT INTO inspirations (id, url, kind, title, author, description, thumbnail, note, intents, matched_clusters, channel_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, i.url, i.kind, i.title, i.author, i.description, i.thumbnail, i.note, JSON.stringify(i.intents), JSON.stringify(i.matchedClusters), activeChannelId(db), now, now);
  indexItem(db, "inspiration", id, i.title ?? i.url ?? "Inspiration", [i.description, i.note, i.author].filter(Boolean).join(" "));
  recordTaste(db, { kind: "inspiration", objectType: "inspiration", objectId: id, tags: tagsOf(`${i.title ?? ""} ${i.description ?? ""} ${i.note ?? ""}`), reason: i.intents.join(",") });
  return getInspiration(db, id)!;
}

export function getInspiration(db: DB, id: string): Inspiration | null {
  const r = db.prepare("SELECT * FROM inspirations WHERE id = ?").get(id) as InspirationRow | undefined;
  return r ? mapInspiration(r) : null;
}

export function listInspirations(db: DB, limit = 200): Inspiration[] {
  return (db.prepare("SELECT * FROM inspirations WHERE channel_id = ? ORDER BY created_at DESC LIMIT ?").all(activeChannelId(db), limit) as InspirationRow[]).map(mapInspiration);
}

export function updateInspiration(db: DB, id: string, patch: Partial<Pick<Inspiration, "note" | "intents" | "analysis" | "title">>): Inspiration | null {
  const cur = getInspiration(db, id);
  if (!cur) return null;
  const n = { ...cur, ...patch };
  db.prepare("UPDATE inspirations SET note = ?, intents = ?, analysis = ?, title = ?, updated_at = ? WHERE id = ?").run(
    n.note, JSON.stringify(n.intents), n.analysis ? JSON.stringify(n.analysis) : null, n.title, nowIso(), id,
  );
  indexItem(db, "inspiration", id, n.title ?? n.url ?? "Inspiration", [n.description, n.note, n.author, n.analysis?.whyItWorks].filter(Boolean).join(" "));
  return getInspiration(db, id);
}

export function deleteInspiration(db: DB, id: string): void {
  db.prepare("DELETE FROM inspirations WHERE id = ?").run(id);
  unindexItem(db, "inspiration", id);
}

// ---------------------------------------------------------------------------
// Taste: behaviour signals, aggregated locally
// ---------------------------------------------------------------------------

export function tagsOf(text: string): string[] {
  return uniqueTokens(text).slice(0, 25);
}

export function recordTaste(
  db: DB,
  e: { kind: string; objectType?: string; objectId?: string; format?: string | null; angleType?: string | null; tags?: string[]; reason?: string | null },
): void {
  db.prepare(
    "INSERT INTO taste_events (id, kind, object_type, object_id, format, angle_type, tags, reason, channel_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(newId("tst"), e.kind, e.objectType ?? null, e.objectId ?? null, e.format ?? null, e.angleType ?? null, JSON.stringify(e.tags ?? []), e.reason ?? null, activeChannelId(db), nowIso());
}

export interface TasteStats {
  formats: { id: string; liked: number; passed: number; score: number }[];
  angleTypes: { id: string; liked: number; passed: number; score: number }[];
  likedTerms: { term: string; n: number }[];
  passedTerms: { term: string; n: number }[];
  reasons: { reason: string; n: number }[];
  events: number;
  eventsSinceSummary: number;
}

const POSITIVE = new Set(["idea-save", "idea-develop", "idea-made", "inspiration", "story-like"]);
const NEGATIVE = new Set(["idea-skip", "story-dislike"]);

/** Local, transparent aggregation of what the user's behaviour shows. No AI. */
export function tasteStats(db: DB, sinceIso?: string): TasteStats {
  const rows = db.prepare("SELECT kind, format, angle_type, tags, reason, created_at FROM taste_events WHERE channel_id = ? ORDER BY created_at DESC LIMIT 2000").all(activeChannelId(db)) as {
    kind: string; format: string | null; angle_type: string | null; tags: string; reason: string | null; created_at: string;
  }[];
  const tally = (key: "format" | "angle_type") => {
    const m = new Map<string, { liked: number; passed: number }>();
    for (const r of rows) {
      const k = r[key];
      if (!k) continue;
      const cur = m.get(k) ?? { liked: 0, passed: 0 };
      if (POSITIVE.has(r.kind)) cur.liked += r.kind === "idea-develop" || r.kind === "idea-made" ? 2 : 1;
      if (NEGATIVE.has(r.kind)) cur.passed++;
      m.set(k, cur);
    }
    return [...m.entries()].map(([id, v]) => ({ id, ...v, score: (v.liked + 1) / (v.liked + v.passed + 2) })).sort((a, b) => b.score - a.score);
  };
  const liked = new Map<string, number>();
  const passed = new Map<string, number>();
  const reasons = new Map<string, number>();
  for (const r of rows) {
    const target = POSITIVE.has(r.kind) ? liked : NEGATIVE.has(r.kind) ? passed : null;
    if (target) for (const t of parseJson<string[]>(r.tags, [])) target.set(t, (target.get(t) ?? 0) + 1);
    if (r.reason && r.kind.startsWith("idea-")) for (const part of r.reason.split(",")) if (part.trim()) reasons.set(part.trim(), (reasons.get(part.trim()) ?? 0) + 1);
  }
  const top = (m: Map<string, number>, other: Map<string, number>) =>
    [...m.entries()].filter(([t, n]) => n >= 2 && n > (other.get(t) ?? 0)).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([term, n]) => ({ term, n }));
  return {
    formats: tally("format"),
    angleTypes: tally("angle_type"),
    likedTerms: top(liked, passed),
    passedTerms: top(passed, liked),
    reasons: [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([reason, n]) => ({ reason, n })),
    events: rows.length,
    eventsSinceSummary: sinceIso ? rows.filter((r) => r.created_at > sinceIso).length : rows.length,
  };
}
