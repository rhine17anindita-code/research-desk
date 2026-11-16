"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";
import { AddSourceForm } from "./research/EvidencePanel";
import { SOURCE_KINDS, type Source } from "@/lib/types";

export function LibraryAddSource() {
  const router = useRouter();
  return (
    <div>
      <div className="eyebrow mb-2">Add a source</div>
      <AddSourceForm onDone={() => router.refresh()} />
      <p className="mt-2 text-[12px] leading-relaxed text-muted">Details are stored exactly as you enter them. Nothing is fetched or filled in automatically.</p>
    </div>
  );
}

export function SourceEditor({ source }: { source: Source }) {
  const router = useRouter();
  const [f, setF] = useState({
    title: source.title, url: source.url ?? "", kind: source.kind, publisher: source.publisher ?? "", authors: source.authors ?? "",
    publishedAt: source.publishedAt?.slice(0, 10) ?? "", excerpt: source.excerpt ?? "", notes: source.notes ?? "", saved: source.saved,
  });
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="space-y-2">
      <div><label className="label">Title</label><input className="input" value={f.title} onChange={set("title")} /></div>
      <div><label className="label">URL</label><input className="input" value={f.url} onChange={set("url")} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label">Type</label><select className="input" value={f.kind} onChange={set("kind")}>{SOURCE_KINDS.map((k) => <option key={k}>{k}</option>)}</select></div>
        <div><label className="label">Date</label><input className="input" value={f.publishedAt} onChange={set("publishedAt")} placeholder="YYYY-MM-DD" /></div>
      </div>
      <div><label className="label">Publisher / institution</label><input className="input" value={f.publisher} onChange={set("publisher")} /></div>
      <div><label className="label">Authors</label><input className="input" value={f.authors} onChange={set("authors")} /></div>
      <div><label className="label">Excerpt / supporting passage</label><textarea className="input min-h-[100px]" value={f.excerpt} onChange={set("excerpt")} /></div>
      <div><label className="label">Your notes</label><textarea className="input min-h-[70px]" value={f.notes} onChange={set("notes")} /></div>
      <label className="flex items-center gap-2 text-[13px] text-ink-2"><input type="checkbox" checked={f.saved} onChange={(e) => setF({ ...f, saved: e.target.checked })} /> Keep in my library</label>
      <div className="flex items-center gap-2">
        <button className="btn-primary" onClick={async () => { await api(`/api/sources/${source.id}`, "PATCH", { ...f, url: f.url || null, publishedAt: f.publishedAt || null }); setMsg("Saved"); router.refresh(); }}>Save changes</button>
        <button className="btn-ghost" onClick={async () => { if (confirm("Delete this source? It will be removed from every question and answer that uses it.")) { await api(`/api/sources/${source.id}`, "DELETE"); router.push("/library"); } }}>Delete</button>
        {msg && <span className="text-[12px] text-ok">{msg}</span>}
      </div>
    </div>
  );
}
