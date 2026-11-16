import type { DB } from "../db";
import { parseJson } from "../db";
import { newId, nowIso } from "../ids";
import type { Answer, AnswerPoint, AnswerState, DeepBrief, Evidence, Question } from "../types";
import { indexItem, unindexItem } from "./search-index";
import { jaccard, uniqueTokens } from "../text";

interface QuestionRow {
  id: string; cluster_id: string | null; project_id: string | null; parent_id: string | null; text: string; dimension: string | null;
  rationale: string | null; answer_state: AnswerState; priority: number; search_terms: string; origin: Question["origin"]; followed: number;
  archived: number; position: number; created_at: string; updated_at: string; answer_count?: number; source_count?: number;
}

export function mapQuestion(r: QuestionRow): Question {
  return {
    id: r.id, clusterId: r.cluster_id, projectId: r.project_id, parentId: r.parent_id, text: r.text, dimension: r.dimension, rationale: r.rationale,
    answerState: r.answer_state, priority: r.priority, searchTerms: parseJson(r.search_terms, []), origin: r.origin, followed: !!r.followed,
    archived: !!r.archived, position: r.position, createdAt: r.created_at, updatedAt: r.updated_at, answerCount: r.answer_count, sourceCount: r.source_count,
  };
}

const Q_SELECT = `SELECT q.*,
  (SELECT COUNT(*) FROM answers a WHERE a.question_id = q.id AND a.superseded = 0) AS answer_count,
  (SELECT COUNT(*) FROM question_sources qs WHERE qs.question_id = q.id AND qs.status = 'attached') AS source_count
  FROM questions q`;

export interface QuestionInput {
  clusterId?: string | null;
  projectId?: string | null;
  parentId?: string | null;
  text: string;
  dimension?: string | null;
  rationale?: string | null;
  answerState?: AnswerState;
  priority?: number;
  searchTerms?: string[];
  origin: Question["origin"];
}

export function createQuestion(db: DB, input: QuestionInput): Question {
  const id = newId("q");
  const now = nowIso();
  const maxPos = (db.prepare("SELECT COALESCE(MAX(position), 0) AS m FROM questions WHERE COALESCE(cluster_id, '') = COALESCE(?, '')").get(input.clusterId ?? null) as { m: number }).m;
  db.prepare(
    `INSERT INTO questions (id, cluster_id, project_id, parent_id, text, dimension, rationale, answer_state, priority, search_terms, origin, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, input.clusterId ?? null, input.projectId ?? null, input.parentId ?? null, input.text.trim(), input.dimension ?? null, input.rationale ?? null,
    input.answerState ?? "unexamined", input.priority ?? 2, JSON.stringify(input.searchTerms ?? []), input.origin, maxPos + 1, now, now,
  );
  indexItem(db, "question", id, input.text, input.rationale ?? "");
  if (input.parentId) {
    db.prepare("INSERT OR IGNORE INTO links (id, from_type, from_id, to_type, to_id, relation, origin, created_at) VALUES (?, 'question', ?, 'question', ?, 'follow_up_of', 'system', ?)")
      .run(newId("lnk"), id, input.parentId, now);
  }
  return getQuestion(db, id)!;
}

export function getQuestion(db: DB, id: string): Question | null {
  const r = db.prepare(`${Q_SELECT} WHERE q.id = ?`).get(id) as QuestionRow | undefined;
  return r ? mapQuestion(r) : null;
}

export function listQuestions(db: DB, opts: { clusterId?: string; projectId?: string; includeArchived?: boolean; ids?: string[] }): Question[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.clusterId) { where.push("q.cluster_id = ?"); params.push(opts.clusterId); }
  if (opts.projectId) {
    where.push("(q.project_id = ? OR q.id IN (SELECT item_id FROM project_items WHERE project_id = ? AND item_type = 'question'))");
    params.push(opts.projectId, opts.projectId);
  }
  if (opts.ids) {
    if (!opts.ids.length) return [];
    where.push(`q.id IN (${opts.ids.map(() => "?").join(",")})`);
    params.push(...opts.ids);
  }
  if (!opts.includeArchived) where.push("q.archived = 0");
  return (db.prepare(`${Q_SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY q.followed DESC, q.priority ASC, q.position ASC`).all(...params) as QuestionRow[]).map(mapQuestion);
}

export function updateQuestion(db: DB, id: string, patch: Partial<Pick<Question, "text" | "dimension" | "rationale" | "answerState" | "priority" | "followed" | "archived" | "position" | "projectId" | "parentId">>): Question | null {
  const cur = getQuestion(db, id);
  if (!cur) return null;
  const n = { ...cur, ...patch };
  db.prepare(
    `UPDATE questions SET text = ?, dimension = ?, rationale = ?, answer_state = ?, priority = ?, followed = ?, archived = ?, position = ?, project_id = ?, parent_id = ?, updated_at = ? WHERE id = ?`,
  ).run(n.text.trim(), n.dimension, n.rationale, n.answerState, n.priority, n.followed ? 1 : 0, n.archived ? 1 : 0, n.position, n.projectId, n.parentId, nowIso(), id);
  indexItem(db, "question", id, n.text, n.rationale ?? "");
  return getQuestion(db, id);
}

export function deleteQuestion(db: DB, id: string): void {
  db.prepare("DELETE FROM questions WHERE id = ?").run(id);
  db.prepare("DELETE FROM links WHERE (from_type = 'question' AND from_id = ?) OR (to_type = 'question' AND to_id = ?)").run(id, id);
  db.prepare("DELETE FROM project_items WHERE item_type = 'question' AND item_id = ?").run(id);
  unindexItem(db, "question", id);
}

/**
 * Combine several questions into one: the first becomes the survivor with new text;
 * answers and sources of the others move to it, the others are archived and linked.
 */
export function mergeQuestions(db: DB, ids: string[], text: string): Question | null {
  if (ids.length < 2) return null;
  const [keep, ...rest] = ids;
  db.transaction(() => {
    for (const id of rest) {
      db.prepare("UPDATE answers SET question_id = ? WHERE question_id = ?").run(keep, id);
      db.prepare("UPDATE OR IGNORE question_sources SET question_id = ? WHERE question_id = ?").run(keep, id);
      db.prepare("DELETE FROM question_sources WHERE question_id = ?").run(id);
      db.prepare("UPDATE questions SET archived = 1, updated_at = ? WHERE id = ?").run(nowIso(), id);
      db.prepare("INSERT OR IGNORE INTO links (id, from_type, from_id, to_type, to_id, relation, note, origin, created_at) VALUES (?, 'question', ?, 'question', ?, 'derived_from', 'merged', 'system', ?)")
        .run(newId("lnk"), keep, id, nowIso());
    }
    updateQuestion(db, keep, { text });
  })();
  return getQuestion(db, keep);
}

/** True when `text` is a near-duplicate of any existing question text. */
export function isDuplicateQuestion(text: string, existing: string[], threshold = 0.6): boolean {
  const t = new Set(uniqueTokens(text));
  return existing.some((e) => jaccard(t, new Set(uniqueTokens(e))) >= threshold);
}

// ---- Answers ---------------------------------------------------------------

interface AnswerRow {
  id: string; question_id: string; level: number; state: string; summary: string; points: string; caveats: string; next_steps: string;
  brief: string | null; origin: Answer["origin"]; model: string | null; superseded: number; created_at: string;
}

export function mapAnswer(r: AnswerRow): Answer {
  return {
    id: r.id, questionId: r.question_id, level: r.level, state: r.state, summary: r.summary, points: parseJson(r.points, []), caveats: parseJson(r.caveats, []),
    nextSteps: parseJson(r.next_steps, []), brief: parseJson(r.brief, null), origin: r.origin, model: r.model, superseded: !!r.superseded, createdAt: r.created_at,
  };
}

export interface AnswerInput {
  questionId: string;
  level: number;
  state: string;
  summary: string;
  points: AnswerPoint[];
  caveats: string[];
  nextSteps: string[];
  brief?: DeepBrief | null;
  origin: "ai" | "user";
  model?: string | null;
  aiRequestId?: string | null;
  evidence: { sourceId: string; claim: string; passage?: string | null; relation?: Evidence["relation"] }[];
}

export function saveAnswer(db: DB, input: AnswerInput): Answer {
  const id = newId("ans");
  const now = nowIso();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO answers (id, question_id, level, state, summary, points, caveats, next_steps, brief, origin, model, ai_request_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id, input.questionId, input.level, input.state, input.summary, JSON.stringify(input.points), JSON.stringify(input.caveats), JSON.stringify(input.nextSteps),
      input.brief ? JSON.stringify(input.brief) : null, input.origin, input.model ?? null, input.aiRequestId ?? null, now, now,
    );
    const ev = db.prepare("INSERT INTO evidence (id, answer_id, source_id, claim, passage, relation, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (const e of input.evidence) ev.run(newId("ev"), id, e.sourceId, e.claim, e.passage ?? null, e.relation ?? "supports", now);
    // Sources used as evidence become attached to the question.
    const qs = db.prepare(
      "INSERT INTO question_sources (question_id, source_id, status, found_by, created_at) VALUES (?, ?, 'attached', 'cited in answer', ?) ON CONFLICT(question_id, source_id) DO UPDATE SET status = 'attached'",
    );
    for (const sid of new Set(input.evidence.map((e) => e.sourceId))) qs.run(input.questionId, sid, now);
    const state = input.state === "user" ? undefined : input.state === "insufficient" ? "insufficient" : input.state;
    if (state) db.prepare("UPDATE questions SET answer_state = ?, updated_at = ? WHERE id = ?").run(state, now, input.questionId);
  })();
  indexItem(db, "answer", id, input.summary, [...input.points.map((p) => p.text), ...input.caveats, ...(input.brief?.findings.map((f) => `${f.heading} ${f.detail}`) ?? [])].join(" "));
  return getAnswer(db, id)!;
}

export function getAnswer(db: DB, id: string): Answer | null {
  const r = db.prepare("SELECT * FROM answers WHERE id = ?").get(id) as AnswerRow | undefined;
  return r ? mapAnswer(r) : null;
}

export function listAnswers(db: DB, questionId: string): Answer[] {
  return (db.prepare("SELECT * FROM answers WHERE question_id = ? ORDER BY superseded ASC, created_at DESC").all(questionId) as AnswerRow[]).map(mapAnswer);
}

export function answerEvidence(db: DB, answerId: string): Evidence[] {
  return (db.prepare("SELECT * FROM evidence WHERE answer_id = ?").all(answerId) as { id: string; answer_id: string; source_id: string; claim: string; passage: string | null; relation: Evidence["relation"] }[]).map(
    (r) => ({ id: r.id, answerId: r.answer_id, sourceId: r.source_id, claim: r.claim, passage: r.passage, relation: r.relation }),
  );
}

export function deleteAnswer(db: DB, id: string): void {
  db.prepare("DELETE FROM answers WHERE id = ?").run(id);
  unindexItem(db, "answer", id);
}

export function supersedeAnswer(db: DB, id: string, superseded: boolean): void {
  db.prepare("UPDATE answers SET superseded = ?, updated_at = ? WHERE id = ?").run(superseded ? 1 : 0, nowIso(), id);
}
