"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../api";
import { FORMATS, WORKFLOW } from "@/lib/youtube/guide";
import type { Review } from "@/lib/youtube";

interface Info {
  ytChannelId: string | null; format: string | null; channels: { id: string; name: string; status: string }[]; description: string | null; checks: string[];
  review: Review; diagnosis: { metric: string; status: "good" | "watch" | "fix"; advice: string }[]; title: string;
}
const TONE = { good: "text-ok", watch: "text-warn", fix: "text-bad" };
const secs = (v: string) => {
  const p = v.split(":").map(Number);
  return p.some(Number.isNaN) ? undefined : p.reduce((a, n) => a * 60 + n, 0);
};
const mmss = (s?: number) => (s == null ? "" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);

/** The YouTube side of one project: channel, format (shapes the script), workflow checklist, title, description, 48-hour review. */
export function ProjectYoutube({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState<Info | null>(null);
  const [title, setTitle] = useState("");
  const [tl, setTl] = useState<{ checks: { ok: boolean; text: string }[]; score: number } | null>(null);
  const [rv, setRv] = useState<Review>({});
  const [copied, setCopied] = useState(false);
  const load = () => api<Info>(`/api/projects/${projectId}/youtube`).then((r) => { setI(r); setRv(r.review); setTitle((t) => t || r.title); });
  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const patch = (p: Record<string, unknown>) => api(`/api/projects/${projectId}/youtube`, "PATCH", p).then(load);
  const fmt = FORMATS.find((f) => f.id === i?.format);
  const total = WORKFLOW.reduce((n, s) => n + s.checks.length, 0);
  return (
    <section className="card overflow-hidden">
      <button className="flex w-full items-center justify-between bg-bad-soft/30 px-4 py-3 text-left" onClick={() => setOpen((o) => !o)}>
        <span>
          <span className="font-serif text-[18px] font-semibold">YouTube</span>
          <span className="ml-2 text-[12px] text-muted">channel, format, checklist, title, description, review</span>
        </span>
        <span className="text-[12px] text-accent">{open ? "Close" : "Open"}</span>
      </button>
      {open && !i && <p className="px-4 py-3 text-[12.5px] text-muted">Loading…</p>}
      {open && i && (
        <div className="space-y-4 px-4 py-3 text-[12.5px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted">For</span>
            <select className="input !w-auto !py-0.5" value={i.ytChannelId ?? ""} onChange={(e) => patch({ ytChannelId: e.target.value })}>
              <option value="">Choose channel…</option>
              {i.channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <span className="text-muted">as a</span>
            <select className="input !w-auto !py-0.5" value={i.format ?? ""} onChange={(e) => patch({ format: e.target.value })}>
              <option value="">Choose format…</option>
              {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.name.split(" (")[0]} · {f.length}</option>)}
            </select>
            <Link href="/youtube?tab=formats" className="text-accent hover:underline">Formats →</Link>
          </div>
          {fmt && (
            <div className="rounded-xl bg-surface-2/60 p-3">
              <b>{fmt.name}</b> <span className="text-muted">· ~{fmt.hours}h · the script writer follows this structure</span>
              <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-ink-2">{fmt.structure.map((s) => <li key={s}>{s}</li>)}</ol>
              <div className="mt-1 text-muted"><b>Thumbnail:</b> {fmt.thumbnail}</div>
            </div>
          )}

          <details>
            <summary className="cursor-pointer font-semibold text-ink">Workflow checklist ({i.checks.length}/{total})</summary>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              {WORKFLOW.map((s) => (
                <div key={s.id}>
                  <div className="font-semibold text-ink-2">{s.title}</div>
                  {s.checks.map((c) => (
                    <label key={c.key} className="flex gap-2 py-0.5">
                      <input type="checkbox" className="mt-0.5" checked={i.checks.includes(c.key)} onChange={(e) => api("/api/youtube/checks", "POST", { scope: `project:${projectId}`, key: c.key, done: e.target.checked }).then(load)} />
                      <span className="text-ink-2">{c.text}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </details>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-1 font-semibold text-ink">Title check</div>
              <div className="flex gap-2">
                <input className="input !py-1" value={title} onChange={(e) => setTitle(e.target.value)} />
                <button className="btn !py-1" onClick={async () => setTl(await api("/api/youtube/title", "POST", { title }))}>Check</button>
              </div>
              {tl && <ul className="mt-1 space-y-0.5">{tl.checks.map((c) => <li key={c.text} className={c.ok ? "text-ok" : "text-warn"}>{c.ok ? "✓" : "•"} {c.text}</li>)}</ul>}
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between font-semibold text-ink">
                Description (ready to paste)
                {i.description && <button className="btn-ghost !px-1 !text-[12px] !text-accent" onClick={async () => { await navigator.clipboard.writeText(i.description!); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied" : "Copy"}</button>}
              </div>
              {i.description ? <pre className="max-h-[220px] overflow-y-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-2 text-[11.5px]">{i.description}</pre> : <p className="text-muted">Write the script first — chapters and sources come from it.</p>}
            </div>
          </div>

          <div>
            <div className="mb-1 font-semibold text-ink">48-hour review <span className="font-normal text-muted">(numbers from YouTube Studio → this video → Analytics)</span></div>
            <div className="flex flex-wrap items-end gap-2">
              <label>CTR %<input type="number" step="0.1" className="input !w-20 !py-0.5" defaultValue={rv.ctr} onChange={(e) => setRv({ ...rv, ctr: e.target.value === "" ? undefined : Number(e.target.value) })} /></label>
              <label>Avg view duration (m:ss)<input className="input !w-24 !py-0.5" defaultValue={mmss(rv.avdSeconds)} onChange={(e) => setRv({ ...rv, avdSeconds: secs(e.target.value) })} /></label>
              <label>Video length (m:ss)<input className="input !w-24 !py-0.5" defaultValue={mmss(rv.lengthSeconds)} onChange={(e) => setRv({ ...rv, lengthSeconds: secs(e.target.value) })} /></label>
              <label>% still watching at 0:30<input type="number" className="input !w-20 !py-0.5" defaultValue={rv.first30} onChange={(e) => setRv({ ...rv, first30: e.target.value === "" ? undefined : Number(e.target.value) })} /></label>
              <label>Views<input type="number" className="input !w-24 !py-0.5" defaultValue={rv.views} onChange={(e) => setRv({ ...rv, views: e.target.value === "" ? undefined : Number(e.target.value) })} /></label>
              <button className="btn-primary !py-1" onClick={() => patch({ review: rv })}>Save & diagnose</button>
            </div>
            <input className="input mt-2 !py-1" placeholder="One lesson for the next video" defaultValue={rv.lesson} onBlur={(e) => patch({ review: { ...rv, lesson: e.target.value } })} />
            {i.diagnosis.length > 0 && <ul className="mt-2 space-y-1">{i.diagnosis.map((x) => <li key={x.metric}><b className={TONE[x.status]}>{x.metric}:</b> <span className="text-ink-2">{x.advice}</span></li>)}</ul>}
          </div>
        </div>
      )}
    </section>
  );
}
