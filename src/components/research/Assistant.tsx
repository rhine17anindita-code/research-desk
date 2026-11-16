"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { Icon } from "../Icon";
import { pctOf } from "@/lib/format";
import type { ChatMessage, Source } from "@/lib/types";

/** Render assistant text: paragraphs, bullets, and [[src:id]] citation markers as numbered chips. */
function Rendered({ text, sources }: { text: string; sources: Map<string, Source> }) {
  const order: string[] = [];
  const blocks = text.split(/\n{2,}/);
  const inline = (s: string, key: string) =>
    s.split(/(\[\[src:[a-z0-9_]+\]\]|\*\*[^*]+\*\*)/g).map((part, i) => {
      const m = part.match(/^\[\[src:([a-z0-9_]+)\]\]$/);
      if (m) {
        if (!order.includes(m[1])) order.push(m[1]);
        const src = sources.get(m[1]);
        return (
          <a key={key + i} href={src?.url ?? `/library/source/${m[1]}`} target="_blank" rel="noreferrer" title={src?.title} className="mx-0.5 inline-flex min-w-[16px] justify-center rounded border border-accent/30 bg-accent-soft px-1 align-baseline text-[10px] font-semibold leading-[15px] text-accent">
            {order.indexOf(m[1]) + 1}
          </a>
        );
      }
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={key + i}>{part.slice(2, -2)}</strong>;
      return <span key={key + i}>{part}</span>;
    });
  return (
    <div className="prose-research text-[13.5px] leading-relaxed text-ink">
      {blocks.map((b, bi) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l))) {
          const ordered = /^\s*\d/.test(lines[0]);
          const items = lines.map((l, li) => <li key={li}>{inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ""), `${bi}-${li}`)}</li>);
          return ordered ? <ol key={bi}>{items}</ol> : <ul key={bi}>{items}</ul>;
        }
        if (/^#{1,4}\s/.test(b)) return <p key={bi} className="font-semibold">{inline(b.replace(/^#{1,4}\s/, ""), String(bi))}</p>;
        return <p key={bi}>{lines.map((l, li) => <span key={li}>{inline(l, `${bi}-${li}`)}{li < lines.length - 1 && <br />}</span>)}</p>;
      })}
    </div>
  );
}

export function Assistant({ contextType, contextId, clusterId, projectId }: { contextType: "cluster" | "project" | "question"; contextId: string; clusterId?: string; projectId?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [sources, setSources] = useState<Map<string, Source>>(new Map());
  const [input, setInput] = useState("");
  const [retrieve, setRetrieve] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<Record<string, string>>({});
  const endRef = useRef<HTMLDivElement>(null);

  async function hydrate(msgs: ChatMessage[]) {
    const ids = [...new Set(msgs.flatMap((m) => m.meta.citedSourceIds ?? []))].filter((id) => !sources.has(id));
    if (!ids.length) return;
    const fetched = await Promise.all(ids.map((id) => api<{ source: Source }>(`/api/sources/${id}`).then((r) => r.source).catch(() => null)));
    setSources((prev) => {
      const next = new Map(prev);
      for (const s of fetched) if (s) next.set(s.id, s);
      return next;
    });
  }

  useEffect(() => {
    void api<{ threadId: string; messages: ChatMessage[] }>(`/api/assistant?contextType=${contextType}&contextId=${contextId}`).then((r) => {
      setThreadId(r.threadId);
      setMessages(r.messages);
      void hydrate(r.messages);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextType, contextId]);

  useEffect(() => endRef.current?.scrollIntoView({ block: "nearest" }), [messages.length]);

  async function send(text = input) {
    if (!text.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const [est, st] = await Promise.all([
        api<{ estimate: { usd: number; model: string } }>("/api/assistant", "POST", { contextType, contextId, message: text, retrieve, estimateOnly: true }),
        api<{ status: { dailyLimit: number } }>("/api/ai/status"),
      ]);
      if (est.estimate.usd > st.status.dailyLimit * 0.03 && !confirm(`This reply could use up to ${pctOf(est.estimate.usd, st.status.dailyLimit)} of today's AI budget. Continue?`)) {
        setBusy(false);
        return;
      }
      const r = await api<{ messages: ChatMessage[] }>("/api/assistant", "POST", { contextType, contextId, message: text, retrieve });
      setMessages((m) => [...m, ...r.messages]);
      setInput("");
      void hydrate(r.messages);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveNote(m: ChatMessage) {
    const body = m.content.replace(/\[\[src:([a-z0-9_]+)\]\]/g, (_, id) => {
      const s = sources.get(id);
      return s ? ` (${s.title}${s.url ? `, ${s.url}` : ""})` : "";
    });
    await api("/api/notes", "POST", { body, origin: "assistant", title: "From the assistant (unverified)", clusterId, projectId });
    setSaved((x) => ({ ...x, [m.id]: "Saved as note" }));
  }

  async function saveQuestion(text: string, key: string) {
    await api("/api/questions", "POST", { text, clusterId, projectId, origin: "assistant" });
    setSaved((x) => ({ ...x, [key]: "Added" }));
  }

  const starters =
    contextType === "project"
      ? ["Turn this into a structured research outline", "What are the biggest evidence gaps?", "What would a sceptical editor challenge?"]
      : ["What important questions have been missed?", "Give historical precedents to compare", "What is the strongest alternative interpretation?"];

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <div className="text-[12.5px] text-muted">
            <p className="mb-2">Ask about this {contextType === "cluster" ? "story" : contextType}. The assistant reads the coverage, your questions, saved answers, attached sources and notes, and cites sources by number.</p>
            <div className="flex flex-col gap-1">
              {starters.map((s) => (
                <button key={s} className="rounded-md border border-line px-2.5 py-1.5 text-left text-[12.5px] text-ink-2 hover:border-line-strong hover:text-ink" onClick={() => send(s)} disabled={busy}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="ml-6 rounded-lg bg-surface-2 px-3 py-2 text-[13.5px] text-ink">{m.content}</div>
          ) : (
            <div key={m.id} className="border-l-2 border-ai/40 pl-3">
              <div className="mb-1 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-wide text-ai">
                Assistant {m.meta.cached && <span className="font-normal normal-case text-muted">· cached</span>}
              </div>
              <Rendered text={m.content} sources={sources} />
              {(m.meta.suggestedQuestions?.length ?? 0) > 0 && (
                <div className="mt-2 space-y-1">
                  {m.meta.suggestedQuestions!.map((q, i) => (
                    <div key={i} className="flex items-start gap-2 text-[12.5px]">
                      <Icon name="question" size={13} className="mt-0.5 shrink-0 text-accent" />
                      <span className="flex-1 text-ink-2">{q}</span>
                      {saved[m.id + i] ? <span className="text-muted">{saved[m.id + i]}</span> : (
                        <button className="btn-ghost !px-1 !py-0 !text-[11.5px]" onClick={() => saveQuestion(q, m.id + i)}>Save question</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-1.5">
                {saved[m.id] ? <span className="text-[11.5px] text-muted">{saved[m.id]}</span> : (
                  <button className="btn-ghost !px-0 !text-[11.5px]" onClick={() => saveNote(m)}>Save as note</button>
                )}
              </div>
            </div>
          ),
        )}
        {busy && <div className="text-[12.5px] text-muted">Thinking{retrieve ? " and searching" : ""}…</div>}
        <div ref={endRef} />
      </div>
      {err && <p className="mt-2 text-[12px] text-bad">{err}</p>}
      <div className="mt-2 border-t border-line pt-2">
        <textarea
          className="input min-h-[64px] text-[13.5px]"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
          }}
          placeholder="Challenge an explanation, compare, ask for precedents…"
        />
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <label className="flex items-center gap-1.5 text-[12px] text-muted" title="Also search OpenAlex, Wikipedia and your library for this message (free searches; adds sources to the prompt)">
            <input type="checkbox" checked={retrieve} onChange={(e) => setRetrieve(e.target.checked)} /> Search for more sources
          </label>
          <div className="flex items-center gap-1">
            {threadId && messages.length > 0 && (
              <button className="btn-ghost !text-[12px]" onClick={async () => { if (confirm("Clear this conversation?")) { await api("/api/assistant", "DELETE", { threadId }); setMessages([]); } }}>Clear</button>
            )}
            <button className="btn-ai" onClick={() => send()} disabled={busy || !input.trim()}>
              <Icon name="spark" size={14} /> Ask
            </button>
          </div>
        </div>
        <p className="mt-1 text-[11px] text-muted">Each message is one AI call. Replies are AI interpretation; check cited sources.</p>
      </div>
    </div>
  );
}
