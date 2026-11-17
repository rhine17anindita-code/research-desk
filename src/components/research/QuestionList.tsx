"use client";

import { useState } from "react";
import { api } from "../api";
import { Icon } from "../Icon";
import { AiButton } from "../AiButton";
import { DimensionLabel, OriginBadge, StateBadge } from "./Badges";
import { ANSWER_STATE_LABELS, type Question } from "@/lib/types";

interface Props {
  questions: Question[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: () => void;
  clusterId?: string;
  projectId?: string;
  renderExpanded?: (q: Question) => React.ReactNode;
}

const FILTERS = ["all", "needs-investigation", "open", "contested", "partial", "established", "unexamined"] as const;

export function QuestionList({ questions, selectedId, onSelect, onChange, clusterId, projectId, renderExpanded }: Props) {
  const [text, setText] = useState("");
  const [guidance, setGuidance] = useState("");
  const [showGuidance, setShowGuidance] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [selecting, setSelecting] = useState<string[]>([]);
  const [mergeText, setMergeText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const visible = questions.filter((q) => filter === "all" || q.answerState === filter);
  const counts = Object.fromEntries(FILTERS.map((f) => [f, f === "all" ? questions.length : questions.filter((q) => q.answerState === f).length]));

  async function add() {
    if (!text.trim()) return;
    setError(null);
    try {
      const { question } = await api<{ question: Question }>("/api/questions", "POST", { clusterId, projectId, text });
      setText("");
      onChange();
      onSelect(question.id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await api(`/api/questions/${id}`, "PATCH", body);
    onChange();
  }

  async function merge() {
    if (selecting.length < 2 || !mergeText.trim()) return;
    await api("/api/questions/merge", "POST", { ids: selecting, text: mergeText });
    setSelecting([]);
    setMergeText("");
    onChange();
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-[20px] font-semibold tracking-tight">Research questions</h2>
        {clusterId && (
          <div className="flex items-center gap-1.5">
            <button className="btn-ghost" onClick={() => setShowGuidance((s) => !s)} title="Steer the next batch">
              Steer
            </button>
            <AiButton
              label="What viewers wonder"
              runningLabel="Thinking like your audience…"
              endpoint={`/api/stories/${clusterId}/questions`}
              payload={{ guidance: guidance || undefined, track: "audience", count: 6 }}
              confirm="always"
              variant="ghost"
              onResult={() => onChange()}
            />
            <AiButton
              label={questions.length ? "More research questions" : "Research questions"}
              runningLabel="Thinking about this story…"
              endpoint={`/api/stories/${clusterId}/questions`}
              payload={{ guidance: guidance || undefined }}
              confirm="always"
              onResult={() => {
                setGuidance("");
                setShowGuidance(false);
                onChange();
              }}
            />
          </div>
        )}
      </div>
      {showGuidance && clusterId && (
        <input
          className="input mb-3"
          value={guidance}
          onChange={(e) => setGuidance(e.target.value)}
          placeholder="Optional direction, e.g. “focus on who finances this” or “historical precedents in South Asia”"
        />
      )}

      <div className="mb-3 flex gap-2">
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Ask your own question…"
        />
        <button className="btn" onClick={add} disabled={!text.trim()}>
          <Icon name="plus" size={14} /> Add
        </button>
      </div>
      {error && <p className="mb-2 text-[12px] text-bad">{error}</p>}

      {questions.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {FILTERS.filter((f) => f === "all" || counts[f] > 0).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-2.5 py-0.5 text-[12px] ${filter === f ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink"}`}
            >
              {f === "all" ? "All" : ANSWER_STATE_LABELS[f]} <span className="tabular-nums opacity-70">{counts[f]}</span>
            </button>
          ))}
        </div>
      )}

      {selecting.length > 0 && (
        <div className="mb-3 rounded-md border border-accent/30 bg-accent-soft/50 p-3">
          <div className="mb-2 text-[12.5px] text-ink-2">
            Combine {selecting.length} questions into one. Answers and sources move to the combined question; the others are archived and linked.
          </div>
          <div className="flex gap-2">
            <input className="input" value={mergeText} onChange={(e) => setMergeText(e.target.value)} placeholder="Wording of the combined question" />
            <button className="btn-primary" disabled={selecting.length < 2 || !mergeText.trim()} onClick={merge}>
              Combine
            </button>
            <button className="btn-ghost" onClick={() => setSelecting([])}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {questions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong px-5 py-8 text-center text-[13.5px] text-muted">
          No questions yet. {clusterId ? "Generate a set from the coverage, or write your own." : "Add one above."}
        </div>
      ) : (
        <ol className="flex flex-col gap-2">
          {visible.map((q) => {
            const open = q.id === selectedId;
            return (
              <li key={q.id} className={`rounded-lg border bg-surface transition-colors ${open ? "border-accent/50 shadow-[0_0_0_1px_var(--accent-soft)]" : "border-line hover:border-line-strong"}`}>
                <div className="flex items-start gap-2.5 px-3.5 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select to combine"
                    className="mt-1.5 opacity-40 hover:opacity-100 checked:opacity-100"
                    checked={selecting.includes(q.id)}
                    onChange={(e) => setSelecting((s) => (e.target.checked ? [...s, q.id] : s.filter((x) => x !== q.id)))}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <StateBadge state={q.answerState} />
                      <DimensionLabel dimension={q.dimension} />
                      <OriginBadge origin={q.origin} />
                      {q.priority === 1 && <span className="text-[11px] font-medium text-accent">High priority</span>}
                      {q.followed && <Icon name="pin" size={13} className="text-accent" />}
                    </div>
                    {editing === q.id ? (
                      <div className="flex gap-2">
                        <textarea className="input min-h-[60px]" value={editText} onChange={(e) => setEditText(e.target.value)} autoFocus />
                        <div className="flex flex-col gap-1">
                          <button className="btn-primary" onClick={async () => { await patch(q.id, { text: editText }); setEditing(null); }}>Save</button>
                          <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button className="block w-full text-left" onClick={() => onSelect(open ? null : q.id)} aria-expanded={open}>
                        <span className="font-serif text-[16px] font-medium leading-snug text-ink">{q.text}</span>
                        {q.rationale && <span className="mt-1 block text-[12.5px] leading-relaxed text-muted">{q.rationale}</span>}
                      </button>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                      {(q.answerCount ?? 0) > 0 && <span>{q.answerCount} answer{q.answerCount === 1 ? "" : "s"}</span>}
                      {(q.sourceCount ?? 0) > 0 && <span>{q.sourceCount} source{q.sourceCount === 1 ? "" : "s"}</span>}
                      <span className="ml-auto flex gap-0.5">
                        <button className="btn-ghost !px-1.5" title={q.followed ? "Unpin" : "Pin to top"} onClick={() => patch(q.id, { followed: !q.followed })}>
                          <Icon name="pin" size={14} />
                        </button>
                        <button className="btn-ghost !px-1.5" title="Edit wording" onClick={() => { setEditing(q.id); setEditText(q.text); }}>
                          <Icon name="edit" size={14} />
                        </button>
                        <select
                          className="rounded border-0 bg-transparent text-[12px] text-muted hover:text-ink"
                          value={q.answerState}
                          onChange={(e) => patch(q.id, { answerState: e.target.value })}
                          title="Set status"
                        >
                          {Object.entries(ANSWER_STATE_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                        <button
                          className="btn-ghost !px-1.5"
                          title="Delete question"
                          onClick={async () => {
                            if (!confirm("Delete this question and its answers? This cannot be undone.")) return;
                            await api(`/api/questions/${q.id}`, "DELETE");
                            if (open) onSelect(null);
                            onChange();
                          }}
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </span>
                    </div>
                  </div>
                </div>
                {open && renderExpanded && <div className="border-t border-line px-3.5 py-3.5">{renderExpanded(q)}</div>}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
