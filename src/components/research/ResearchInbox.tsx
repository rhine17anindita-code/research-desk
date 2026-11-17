"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../api";
import { Icon } from "../Icon";
import { AiButton } from "../AiButton";
import { InlineIdeas } from "../studio/InlineIdeas";
import { timeAgo } from "@/lib/format";
import type { ResearchView } from "@/lib/research-inbox";

type Mode = "link" | "text" | "file" | "note";
const MODES: [Mode, string, string][] = [
  ["link", "Link", "A news article, YouTube video, report or post. The full text is pulled in where the site allows it."],
  ["text", "Paste text", "Copied an article, a post, a statement or a transcript? Paste it all."],
  ["file", "Screenshot / PDF", "A Facebook post, a TV still, a gazette notice, a report. AI reads it (Bangla too) when you ask."],
  ["note", "Quick note", "Something you saw or heard: “Saw on Somoy TV at 9pm: …”"],
];

/** Add anything you found yourself. Free: nothing is sent to AI until you press an AI button. */
export function ResearchAdd({ prefill, onAdded, compact }: { prefill?: { url?: string; text?: string; title?: string }; onAdded?: (r: ResearchView) => void; compact?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(prefill?.url ? "link" : prefill?.text ? "text" : "link");
  const [url, setUrl] = useState(prefill?.url ?? "");
  const [text, setText] = useState(prefill?.text ?? "");
  const [title, setTitle] = useState(prefill?.title ?? "");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const add = async () => {
    setBusy(true);
    setErr(null);
    try {
      let item: ResearchView;
      if (mode === "file") {
        if (!file) throw new Error("Choose a file first");
        const fd = new FormData();
        fd.append("file", file);
        if (note) fd.append("note", note);
        if (title) fd.append("title", title);
        const res = await fetch("/api/research-items", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok || data.ok === false) throw new Error(data.message || "Upload failed");
        item = data.item;
      } else {
        const payload = mode === "link" ? { url, note, title } : mode === "text" ? { text, note, title } : { note: text || note };
        item = (await api<{ item: ResearchView }>("/api/research-items", "POST", payload)).item;
      }
      setUrl(""); setText(""); setTitle(""); setNote(""); setFile(null);
      onAdded?.(item);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-4">
      {!compact && <h2 className="mb-2 font-serif text-[18px] font-semibold">Add your own research</h2>}
      <div className="mb-2 flex flex-wrap gap-1">
        {MODES.map(([m, l]) => <button key={m} className={mode === m ? "chip-accent" : "chip"} onClick={() => setMode(m)}>{l}</button>)}
      </div>
      <p className="mb-2 text-[12px] text-muted">{MODES.find((m) => m[0] === mode)![2]}</p>
      <div className="space-y-2">
        {mode === "link" && <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />}
        {mode === "text" && <textarea className="input min-h-[140px] text-[13px]" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the article, post or statement…" />}
        {mode === "note" && <textarea className="input min-h-[80px] text-[13px]" value={text} onChange={(e) => setText(e.target.value)} placeholder="What did you see or hear, where, and when?" />}
        {mode === "file" && <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,.txt,.md,.csv" className="block text-[13px]" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />}
        {mode !== "note" && (
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="input text-[13px]" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" />
            <input className="input text-[13px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Your note: why it matters, what you want to make…" />
          </div>
        )}
        <div className="flex items-center gap-2">
          <button className="btn-primary" disabled={busy} onClick={add}>
            <Icon name="plus" size={14} /> {busy ? (mode === "link" ? "Reading the page…" : "Adding…") : "Add to my research"}
          </button>
          {err && <span className="text-[12.5px] text-bad">{err}</span>}
        </div>
      </div>
    </section>
  );
}

const KIND: Record<string, string> = { link: "Link", text: "Pasted", file: "File", note: "Note" };

/** One item: what was read, related stories, and what to do with it. */
export function ResearchCard({ item: initial, defaultOpen }: { item: ResearchView; defaultOpen?: boolean }) {
  const router = useRouter();
  const [item, setItem] = useState(initial);
  const [show, setShow] = useState(false);
  const [ideas, setIdeas] = useState(!!defaultOpen);
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setItem(initial), [initial]);

  const startProject = async () => {
    setBusy(true);
    try {
      const r = await api<{ project: { id: string } }>("/api/projects", "POST", { title: item.title, thesis: item.note ?? undefined, item: item.sourceId ? { type: "source", id: item.sourceId } : undefined });
      for (const s of item.stories.slice(0, 3)) await api(`/api/projects/${r.project.id}/items`, "POST", { itemType: "cluster", itemId: s.id }).catch(() => {});
      await api(`/api/research-items/${item.id}`, "PATCH", { projectId: r.project.id });
      router.push(`/research/${r.project.id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="card px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="chip !text-[11px]">{KIND[item.kind]}{item.fileType ? ` · ${item.fileType.split("/")[1]}` : ""}</span>
        <h3 className="min-w-0 flex-1 font-serif text-[16px] font-semibold leading-snug">{item.title}</h3>
        <span className="text-[11.5px] text-muted">{timeAgo(item.createdAt)}</span>
      </div>
      {item.url && <a href={item.url} target="_blank" rel="noreferrer" className="block truncate text-[12px] text-muted hover:underline">{item.url}</a>}
      {item.note && item.kind !== "note" && <p className="mt-1 text-[12.5px] text-ink-2"><span className="text-muted">Your note:</span> {item.note}</p>}
      {item.summary && <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{item.summary}</p>}
      {item.body && (
        <div className="mt-1">
          <p className={`whitespace-pre-line text-[12.5px] leading-relaxed text-muted ${show ? "max-h-[420px] overflow-y-auto" : "line-clamp-3"}`}>{item.body}</p>
          <button className="btn-ghost !px-0 !text-[12px]" onClick={() => setShow((s) => !s)}>{show ? "Less" : `Read all (${Math.round(item.chars / 100) / 10}K characters)`}</button>
        </div>
      )}
      {item.error && <p className="mt-1 text-[12px] text-warn">{item.error}</p>}
      {item.status === "thin" && (
        <div className="mt-1 flex gap-2">
          <textarea className="input min-h-[60px] flex-1 text-[12.5px]" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste the full text here…" />
          <button className="btn self-start" disabled={paste.trim().length < 50} onClick={async () => { const r = await api<{ item: ResearchView }>(`/api/research-items/${item.id}`, "PATCH", { body: paste }); setItem(r.item); setPaste(""); }}>Save text</button>
        </div>
      )}
      {item.stories.length > 0 && (
        <div className="mt-2 text-[12px]">
          <span className="text-muted">Related stories already on the desk: </span>
          {item.stories.slice(0, 3).map((s, i) => (
            <span key={s.id}>{i ? " · " : ""}<Link href={`/story/${s.id}`} className="text-accent hover:underline">{s.headline}</Link></span>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {item.status === "needs_read" ? (
          <AiButton size="sm" label="Read it (text, summary, key facts)" endpoint={`/api/research-items/${item.id}/read`} confirm="always" runningLabel="Reading…" onResult={(r) => setItem(r.data as ResearchView)} />
        ) : (
          <button className="btn !py-1 !text-[12.5px] !text-accent" onClick={() => setIdeas((o) => !o)}><Icon name={ideas ? "up" : "bulb"} size={13} /> {ideas ? "Close ideas" : "Angles & ideas from this"}</button>
        )}
        {item.projectId ? (
          <Link href={`/research/${item.projectId}`} className="btn !py-1 !text-[12.5px]"><Icon name="research" size={13} /> Open its project</Link>
        ) : (
          <button className="btn !py-1 !text-[12.5px]" disabled={busy || item.status === "needs_read"} onClick={startProject}><Icon name="research" size={13} /> Make it a project</button>
        )}
        <button
          className="btn-ghost ml-auto !px-1 !text-[12px] !text-muted"
          onClick={async () => {
            if (!confirm("Remove this from your research? Ideas and projects made from it stay.")) return;
            await api(`/api/research-items/${item.id}`, "DELETE");
            router.refresh();
          }}
        >
          <Icon name="trash" size={12} /> Remove
        </button>
      </div>
      {ideas && item.status !== "needs_read" && (
        <div className="mt-2">
          <InlineIdeas payload={{ researchIds: [item.id], clusterIds: item.stories.length ? item.stories.slice(0, 3).map((s) => s.id) : undefined }} label="Find angles & ideas" count={4} />
        </div>
      )}
    </article>
  );
}
