"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../api";
import { Icon } from "../Icon";
import { OriginBadge } from "./Badges";
import { timeAgo } from "@/lib/format";
import type { Note } from "@/lib/types";

export function NotesPanel({ notes, clusterId, projectId, questionId, title = "Notes" }: { notes: Note[]; clusterId?: string; projectId?: string; questionId?: string; title?: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  return (
    <div>
      <div className="eyebrow mb-1.5">{title}</div>
      <textarea className="input min-h-[60px] text-[13px]" value={text} onChange={(e) => setText(e.target.value)} placeholder="Observations, leads, people to call…" />
      <div className="mt-1 flex justify-end">
        <button
          className="btn !py-1"
          disabled={!text.trim()}
          onClick={async () => {
            await api("/api/notes", "POST", { body: text, clusterId, projectId, questionId });
            setText("");
            router.refresh();
          }}
        >
          Add note
        </button>
      </div>
      <ul className="mt-2 space-y-2">
        {notes.map((n) => (
          <li key={n.id} id={n.id} className="group rounded-md border border-line bg-surface px-2.5 py-2 text-[13px]">
            <div className="mb-1 flex items-center gap-2 text-[11.5px] text-muted">
              <OriginBadge origin={n.origin === "assistant" ? "assistant" : "user"} />
              {n.title && <span className="font-medium text-ink-2">{n.title}</span>}
              <span>{timeAgo(n.updatedAt)}</span>
              <span className="ml-auto flex opacity-0 group-hover:opacity-100">
                <button className="btn-ghost !px-1" onClick={() => { setEditing(n.id); setEditText(n.body); }}><Icon name="edit" size={12} /></button>
                <button className="btn-ghost !px-1" onClick={async () => { if (confirm("Delete this note?")) { await api(`/api/notes/${n.id}`, "DELETE"); router.refresh(); } }}><Icon name="trash" size={12} /></button>
              </span>
            </div>
            {editing === n.id ? (
              <div>
                <textarea className="input min-h-[80px] text-[13px]" value={editText} onChange={(e) => setEditText(e.target.value)} />
                <div className="mt-1 flex justify-end gap-1">
                  <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                  <button className="btn-primary !py-1" onClick={async () => { await api(`/api/notes/${n.id}`, "PATCH", { body: editText }); setEditing(null); router.refresh(); }}>Save</button>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-wrap leading-relaxed text-ink-2">{n.body}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
