"use client";

import { useState } from "react";
import { api } from "../api";
import { Icon } from "../Icon";
import { AiButton } from "../AiButton";
import { AddToProject, Connections } from "./Connections";
import type { QuestionDetail } from "@/lib/research/question-detail";
import { SOURCE_KINDS, type Source } from "@/lib/types";
import { hostOf } from "@/lib/format";

const PROVIDER_LABEL: Record<string, string> = { feed: "Your feeds", openalex: "OpenAlex", crossref: "Crossref", wikipedia: "Wikipedia", gdelt: "GDELT news", user: "Added by you", local: "Your library" };

export function SourceItem({ s, n, actions }: { s: Source; n?: number; actions?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-md border border-line bg-surface px-2.5 py-2">
      <div className="flex items-start gap-2">
        {n !== undefined && <span className="mt-0.5 inline-flex min-w-[18px] justify-center rounded border border-accent/30 bg-accent-soft px-1 text-[10.5px] font-semibold leading-[16px] text-accent">{n}</span>}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 text-[11px] uppercase tracking-wide text-muted">
            <span className="font-semibold">{s.kind}</span>
            <span>·</span>
            <span>{PROVIDER_LABEL[s.provider] ?? s.provider}</span>
          </div>
          {s.url ? (
            <a href={s.url} target="_blank" rel="noreferrer" className="block text-[13px] font-medium leading-snug text-ink hover:underline">
              {s.title} <Icon name="external" size={11} className="inline text-muted" />
            </a>
          ) : (
            <div className="text-[13px] font-medium leading-snug text-ink">{s.title}</div>
          )}
          <div className="text-[12px] text-muted">
            {[s.authors && s.authors.slice(0, 80), s.publisher ?? hostOf(s.url), s.publishedAt?.slice(0, 10)].filter(Boolean).join(" · ")}
          </div>
          {s.excerpt && (
            <button className="mt-1 block text-left text-[12px] leading-relaxed text-ink-2" onClick={() => setOpen((o) => !o)}>
              <span className={open ? "" : "line-clamp-2"}>{s.excerpt}</span>
            </button>
          )}
          {!s.excerpt && <div className="mt-0.5 text-[11.5px] italic text-muted">No abstract or excerpt available — only the title is known.</div>}
          {s.notes && <div className="mt-1 text-[11.5px] text-muted">{s.notes}</div>}
          {actions && <div className="mt-1.5 flex flex-wrap gap-1">{actions}</div>}
        </div>
      </div>
    </li>
  );
}

export function AddSourceForm({ questionId, projectId, onDone }: { questionId?: string; projectId?: string; onDone: () => void }) {
  const [f, setF] = useState({ title: "", url: "", kind: "report", publisher: "", authors: "", publishedAt: "", excerpt: "" });
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="space-y-1.5 rounded-md border border-line p-2.5">
      <input className="input !py-1 text-[13px]" placeholder="Title *" value={f.title} onChange={set("title")} />
      <input className="input !py-1 text-[13px]" placeholder="URL" value={f.url} onChange={set("url")} />
      <div className="grid grid-cols-2 gap-1.5">
        <select className="input !py-1 text-[13px]" value={f.kind} onChange={set("kind")}>
          {SOURCE_KINDS.map((k) => <option key={k}>{k}</option>)}
        </select>
        <input className="input !py-1 text-[13px]" placeholder="Date (YYYY-MM-DD)" value={f.publishedAt} onChange={set("publishedAt")} />
      </div>
      <input className="input !py-1 text-[13px]" placeholder="Publisher / institution" value={f.publisher} onChange={set("publisher")} />
      <input className="input !py-1 text-[13px]" placeholder="Authors" value={f.authors} onChange={set("authors")} />
      <textarea className="input min-h-[60px] text-[13px]" placeholder="Relevant passage or summary (used as evidence text)" value={f.excerpt} onChange={set("excerpt")} />
      {err && <p className="text-[12px] text-bad">{err}</p>}
      <div className="flex justify-end">
        <button
          className="btn-primary !py-1"
          disabled={!f.title.trim()}
          onClick={async () => {
            setErr(null);
            try {
              await api("/api/sources", "POST", { ...f, questionId, projectId });
              setF({ title: "", url: "", kind: "report", publisher: "", authors: "", publishedAt: "", excerpt: "" });
              onDone();
            } catch (e) {
              setErr((e as Error).message);
            }
          }}
        >
          Save source
        </button>
      </div>
    </div>
  );
}

/** Right-hand panel for the selected question: research controls, evidence, connections. */
export function EvidencePanel({ detail, reload }: { detail: QuestionDetail; reload: () => void }) {
  const q = detail.question;
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcomes, setOutcomes] = useState<{ provider: string; query: string; found: number; error?: string }[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [showRejected, setShowRejected] = useState(false);

  const attached = detail.sources.filter((s) => s.status === "attached");
  const candidates = detail.sources.filter((s) => s.status === "candidate");
  const index = new Map(detail.sources.map((s, i) => [s.id, i + 1]));

  async function setStatus(sourceId: string, status: string) {
    await api(`/api/questions/${q.id}/sources`, "POST", { sourceId, status });
    reload();
  }

  async function explore() {
    setBusy(true);
    setOutcomes(null);
    try {
      const r = await api<{ outcomes: typeof outcomes }>(`/api/questions/${q.id}/explore`, "POST", { query: query || undefined });
      setOutcomes(r.outcomes);
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <section>
        <div className="eyebrow mb-1.5">Research depth</div>
        <div className="space-y-2.5 text-[12.5px] text-ink-2">
          <div>
            <div className="flex gap-1.5">
              <input className="input !py-1 text-[12.5px]" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={q.searchTerms[0] ?? "Search terms (optional)"} onKeyDown={(e) => e.key === "Enter" && explore()} />
              <button className="btn shrink-0" onClick={explore} disabled={busy}>
                <Icon name="search" size={13} /> {busy ? "Searching…" : "Find sources"}
              </button>
            </div>
            <p className="mt-1 text-[11.5px] text-muted">Free · no AI. Searches your library, OpenAlex, Crossref, Wikipedia and GDELT; results arrive as candidates for you to judge.</p>
            {outcomes && (
              <ul className="mt-1.5 space-y-0.5 text-[11.5px] text-muted">
                {outcomes.map((o, i) => (
                  <li key={i}>
                    {PROVIDER_LABEL[o.provider] ?? o.provider}: {o.error ? <span className="text-bad">unavailable ({o.error})</span> : `${o.found} found`} <span className="opacity-70">for “{o.query}”</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-md border border-ai/20 bg-ai-soft/40 p-2.5">
            <div className="mb-1 font-medium text-ink">Deep research</div>
            <p className="mb-2 text-[11.5px] text-muted">Plans several searches, gathers papers, reference and news material, compares the evidence and writes a structured brief with competing explanations and gaps. Two AI calls.</p>
            <AiButton label="Run deep research" endpoint={`/api/questions/${q.id}/deep`} confirm="always" runningLabel="Researching (up to a minute)…" onResult={reload} size="sm" />
          </div>
        </div>
      </section>

      <section>
        <div className="mb-1.5 flex items-center justify-between">
          <div className="eyebrow">Evidence · {attached.length}</div>
          <button className="btn-ghost !px-1.5 !text-[12px]" onClick={() => setAdding((a) => !a)}><Icon name="plus" size={13} /> Add source</button>
        </div>
        {adding && <div className="mb-2"><AddSourceForm questionId={q.id} onDone={() => { setAdding(false); reload(); }} /></div>}
        {attached.length === 0 ? (
          <p className="text-[12.5px] text-muted">Nothing attached yet. Attach candidates below, add a source by hand, or let an answer cite the story coverage.</p>
        ) : (
          <ul className="space-y-1.5">
            {attached.map((s) => (
              <SourceItem key={s.id} s={s} n={index.get(s.id)} actions={<button className="btn-ghost !px-1 !py-0 !text-[11.5px]" onClick={() => setStatus(s.id, "candidate")}>Detach</button>} />
            ))}
          </ul>
        )}
      </section>

      {candidates.length > 0 && (
        <section>
          <div className="eyebrow mb-1.5">Candidates · {candidates.length}</div>
          <ul className="space-y-1.5">
            {candidates.map((s) => (
              <SourceItem
                key={s.id}
                s={s}
                n={index.get(s.id)}
                actions={
                  <>
                    <button className="btn-ghost !px-1 !py-0 !text-[11.5px] !text-ok" onClick={() => setStatus(s.id, "attached")}><Icon name="check" size={12} /> Attach</button>
                    <button className="btn-ghost !px-1 !py-0 !text-[11.5px]" onClick={() => setStatus(s.id, "rejected")}>Not relevant</button>
                    {s.foundBy && <span className="text-[11px] text-muted">via {s.foundBy}</span>}
                  </>
                }
              />
            ))}
          </ul>
        </section>
      )}
      <button className="btn-ghost !px-0 !text-[11.5px]" onClick={() => setShowRejected((x) => !x)}>{showRejected ? "Hide" : "Show"} sources marked not relevant</button>
      {showRejected && <RejectedList questionId={q.id} onRestore={reload} />}

      <section>
        <Connections type="question" id={q.id} initial={detail.links} key={q.id + detail.links.length} />
      </section>
      <section>
        <div className="eyebrow mb-1.5">Projects</div>
        <AddToProject itemType="question" itemId={q.id} current={detail.projects} key={q.id} />
      </section>
    </div>
  );
}

function RejectedList({ questionId, onRestore }: { questionId: string; onRestore: () => void }) {
  const [items, setItems] = useState<Source[] | null>(null);
  if (items === null) {
    void api<{ sources: Source[] }>(`/api/questions/${questionId}/sources?status=rejected`).then((r) => setItems(r.sources)).catch(() => setItems([]));
    return <p className="text-[12px] text-muted">Loading…</p>;
  }
  if (!items.length) return <p className="text-[12px] text-muted">None.</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((s) => (
        <SourceItem key={s.id} s={s} actions={<button className="btn-ghost !px-1 !py-0 !text-[11.5px]" onClick={async () => { await api(`/api/questions/${questionId}/sources`, "POST", { sourceId: s.id, status: "candidate" }); onRestore(); setItems(null); }}>Restore</button>} />
      ))}
    </ul>
  );
}
