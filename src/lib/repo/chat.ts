import type { DB } from "../db";
import { parseJson } from "../db";
import { newId, nowIso } from "../ids";
import type { ChatMessage } from "../types";

export function getOrCreateThread(db: DB, contextType: string, contextId: string): string {
  const r = db.prepare("SELECT id FROM chat_threads WHERE context_type = ? AND context_id = ? ORDER BY created_at DESC LIMIT 1").get(contextType, contextId) as { id: string } | undefined;
  if (r) return r.id;
  const id = newId("thr");
  db.prepare("INSERT INTO chat_threads (id, context_type, context_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(id, contextType, contextId, nowIso(), nowIso());
  return id;
}

export function addMessage(db: DB, threadId: string, role: "user" | "assistant", content: string, meta: ChatMessage["meta"] = {}, aiRequestId?: string): ChatMessage {
  const id = newId("msg");
  db.prepare("INSERT INTO chat_messages (id, thread_id, role, content, meta, ai_request_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    id, threadId, role, content, JSON.stringify(meta), aiRequestId ?? null, nowIso(),
  );
  db.prepare("UPDATE chat_threads SET updated_at = ? WHERE id = ?").run(nowIso(), threadId);
  return { id, threadId, role, content, meta, createdAt: nowIso() };
}

export function listMessages(db: DB, threadId: string): ChatMessage[] {
  return (db.prepare("SELECT * FROM chat_messages WHERE thread_id = ? ORDER BY created_at ASC").all(threadId) as { id: string; thread_id: string; role: ChatMessage["role"]; content: string; meta: string; created_at: string }[]).map(
    (r) => ({ id: r.id, threadId: r.thread_id, role: r.role, content: r.content, meta: parseJson(r.meta, {}), createdAt: r.created_at }),
  );
}

export function clearThread(db: DB, threadId: string): void {
  db.prepare("DELETE FROM chat_messages WHERE thread_id = ?").run(threadId);
}
