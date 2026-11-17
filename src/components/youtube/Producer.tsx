"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../api";
import { Icon } from "../Icon";
import type { Brief } from "@/lib/youtube/producer";
import { FORMATS } from "@/lib/youtube/guide";

type StepId = "brief" | "research" | "outline" | "script" | "package";
const STEPS: { id: StepId; label: string; what: string }[] = [
  { id: "brief", label: "Strategy", what: "Angle, promise, 10 titles, 3 thumbnails, the hook, format and length — with the evidence" },
  { id: "research", label: "Research", what: "Full articles read; facts with sources, timeline, numbers, quotes, the other side, visuals to show" },
  { id: "outline", label: "Outline", what: "Escalating beats from the hook to the payoff" },
  { id: "script", label: "Script", what: "Written in your voice, following the format and the brief" },
  { id: "package", label: "Package", what: "Shot list, thumbnail & titles, Shorts to cut, description and captions" },
];
interface Info {
  title: string; status: Record<StepId, boolean>; brief: Brief | null; dossier: string; outline: string; script: string; hook: string; format: string | null; channel: string | null;
  prompter: { section: string; lines: string[] }[]; pack: string | null; publishDate: string | null; voiceReady: boolean;
}

/** One video, end to end: pick → the producer does strategy, research, outline, script, packaging → you record. */
export function Producer({ projectId }: { projectId: string }) {
  const [i, setI] = useState<Info | null>(null);
  const [running, setRunning] = useState<StepId | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [view, setView] = useState<StepId>("brief");
  const [direction, setDirection] = useState("");
  const load = () => api<Info>(`/api/youtube/produce/${projectId}`).then(setI);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (step: StepId) => {
    setRunning(step);
    setView(step);
    setMsg(null);
    try {
      await api(`/api/youtube/produce/${projectId}`, "POST", { step, direction: direction || undefined });
      await load();
      return true;
    } catch (e) {
      setMsg(`${STEPS.find((s) => s.id === step)!.label}: ${(e as Error).message}`);
      return false;
    } finally {
      setRunning(null);
    }
  };

  const produceAll = async (from: StepId | null = null) => {
    if (!i) return;
    const todo = STEPS.filter((s, k) => (from ? k >= STEPS.findIndex((x) => x.id === from) : !i.status[s.id])).map((s) => s.id);
    if (!todo.length) return;
    setMsg("Working out the cost…");
    let usd = 0;
    for (const s of todo) {
      try {
        const r = await api<{ estimate?: { usd: number } }>(`/api/youtube/produce/${projectId}`, "POST", { step: s, estimateOnly: true });
        usd += r.estimate?.usd ?? 0;
      } catch {
        /* estimate unavailable: still ask */
      }
    }
    const status = await api<{ status: { monthlyLimit: number; spentToday: number; dailyLimit: number } }>("/api/ai/status");
    const pct = status.status.monthlyLimit ? (usd / status.status.monthlyLimit) * 100 : 0;
    setMsg(null);
    if (!confirm(`Produce ${todo.length} step${todo.length === 1 ? "" : "s"} (${todo.join(", ")})?\n\nWorst case about ${pct.toFixed(1)}% of your monthly AI budget. Takes a few minutes.\nToday's limit left: ${Math.max(0, (1 - status.status.spentToday / status.status.dailyLimit) * 100).toFixed(0)}%.`)) return;
    for (const s of todo) if (!(await run(s))) break;
  };

  if (!i) return <p className="text-[13px] text-muted">Loading…</p>;
  const done = STEPS.filter((s) => i.status[s.id]).length;
  const fmt = FORMATS.find((f) => f.id === i.format);
  return (
    <div className="space-y-4">
      <Link href="/youtube" className="text-[12.5px] text-accent hover:underline">← YouTube</Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12.5px] font-medium text-accent">{i.channel ?? "YouTube"}{fmt ? ` · ${fmt.name.split(" (")[0]}` : ""}</div>
          <h1 className="font-serif text-[26px] font-bold leading-tight">{i.title}</h1>
          <div className="mt-1 text-[12.5px] text-muted">{done === 5 ? "Ready to record." : `${done} of 5 steps done.`} {!i.voiceReady && <Link href="/voice" className="text-warn underline">Set up Voice Lab so scripts sound like you</Link>}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {i.script && <Link href={`/youtube/prompter/${projectId}`} className="btn-primary"><Icon name="right" size={14} /> Teleprompter</Link>}
          {i.pack && <a className="btn" download={`recording-pack-${i.title.replace(/[^\w]+/g, "-").slice(0, 50)}.md`} href={`data:text/markdown;charset=utf-8,${encodeURIComponent(i.pack)}`}>Recording pack</a>}
          <label className="flex items-center gap-1 text-[12.5px] text-muted">Goes out
            <input type="date" className="input !w-auto !py-0.5" defaultValue={i.publishDate ?? ""} onChange={(e) => api(`/api/projects/${projectId}/production`, "PATCH", { publishDate: e.target.value || null })} />
          </label>
        </div>
      </header>

      <section className="card px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-primary" disabled={!!running || done === 5} onClick={() => produceAll()}>{running ? "Producing…" : done === 0 ? "Produce everything" : done === 5 ? "All done" : "Produce the rest"}</button>
          <input className="input !w-full !py-1 text-[12.5px] sm:!w-96" value={direction} onChange={(e) => setDirection(e.target.value)} placeholder="Any direction for the producer (optional): tone, what to focus on, what to avoid" />
          <Link href={`/research/${projectId}`} className="ml-auto text-[12.5px] text-accent hover:underline">Open the full project →</Link>
        </div>
        {msg && <p className="mt-2 text-[12.5px] text-warn">{msg}</p>}
        <ol className="mt-3 grid gap-2 sm:grid-cols-5">
          {STEPS.map((s, k) => (
            <li key={s.id}>
              <button onClick={() => setView(s.id)} className={`w-full rounded-xl border px-2.5 py-2 text-left ${view === s.id ? "border-accent bg-accent-soft/50" : "border-line"}`}>
                <div className="flex items-center justify-between text-[12.5px] font-semibold">
                  <span>{k + 1}. {s.label}</span>
                  <span className={i.status[s.id] ? "text-ok" : running === s.id ? "text-accent" : "text-muted"}>{running === s.id ? "…" : i.status[s.id] ? "✓" : ""}</span>
                </div>
                <div className="mt-0.5 line-clamp-2 text-[11px] text-muted">{s.what}</div>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section className="card px-4 py-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-[19px] font-semibold">{STEPS.find((s) => s.id === view)!.label}</h2>
          <span className="flex gap-2">
            <button className="btn !py-1 !text-[12.5px]" disabled={!!running} onClick={() => run(view)}>{running === view ? "Working…" : i.status[view] ? "Redo this step" : "Do this step"}</button>
            {i.status[view] && view !== "package" && <button className="btn !py-1 !text-[12.5px]" disabled={!!running} onClick={() => produceAll(view)}>Redo from here</button>}
          </span>
        </div>
        {view === "brief" && (i.brief ? <BriefView b={i.brief} projectId={projectId} onTitle={load} /> : <Empty text="The strategist decides the angle, title, thumbnail, hook, format and length from your competitors' breakouts, your own numbers and what people search." />)}
        {view === "research" && (i.dossier ? <Doc text={i.dossier} /> : <Empty text="Reads the full articles behind this video and builds the facts sheet with sources." />)}
        {view === "outline" && (i.outline ? <Doc text={i.outline} /> : <Empty text="The beats, built on the brief's hook and the research." />)}
        {view === "script" && (i.script ? (
          <>
            <p className="mb-2 text-[12.5px] text-muted">Edit anything in the <Link href={`/research/${projectId}`} className="text-accent underline">project&apos;s Script tab</Link> (select a passage to rewrite it). Your edits teach future scripts.</p>
            <Doc text={i.script} />
          </>
        ) : <Empty text="Written in your voice (Voice Lab), following the format's structure and the brief." />)}
        {view === "package" && (i.pack && i.status.package ? <Doc text={i.pack} /> : <Empty text="Shot list, thumbnail and title options, Shorts to cut, description and captions — then the recording pack is complete." />)}
      </section>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-[13px] text-muted">{text}</p>;
}

/** Light markdown: headings, bullets, bold. */
function Doc({ text }: { text: string }) {
  return (
    <div className="max-h-[640px] space-y-1 overflow-y-auto text-[13px] leading-relaxed text-ink-2">
      {text.split("\n").map((l, k) => {
        const t = l.trim();
        if (!t) return <div key={k} className="h-2" />;
        const html = t.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
        if (t.startsWith("# ")) return <h3 key={k} className="font-serif text-[18px] font-semibold text-ink">{t.slice(2)}</h3>;
        if (t.startsWith("## ")) return <h4 key={k} className="pt-2 font-serif text-[16px] font-semibold text-ink">{t.slice(3)}</h4>;
        if (t.startsWith("### ")) return <h5 key={k} className="pt-1 font-semibold text-ink">{t.slice(4)}</h5>;
        if (t.startsWith("▸")) return <p key={k} className="pl-4 text-[12px] italic text-accent">{t}</p>;
        if (/^[-*] /.test(t)) return <p key={k} className="pl-3" dangerouslySetInnerHTML={{ __html: `• ${html.slice(2)}` }} />;
        return <p key={k} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </div>
  );
}

function BriefView({ b, projectId, onTitle }: { b: Brief; projectId: string; onTitle: () => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const H = ({ children }: { children: React.ReactNode }) => <h3 className="mb-1 mt-3 text-[11.5px] font-semibold uppercase tracking-wide text-muted">{children}</h3>;
  return (
    <div className="grid gap-x-6 text-[13px] md:grid-cols-2">
      <div>
        <p className="rounded-xl bg-accent-soft px-3 py-2 font-serif text-[15px] text-ink"><b>Angle:</b> {b.angle}</p>
        <H>For</H><p className="text-ink-2">{b.viewer}</p>
        <H>Promise</H><p className="text-ink-2">{b.promise}</p>
        <H>Why now</H><p className="text-ink-2">{b.why_now}</p>
        <H>Why it should work</H><p className="text-ink-2">{b.why_it_works}</p>
        <H>Hook (first lines)</H><p className="rounded-lg bg-surface-2 px-3 py-2 italic text-ink">{b.hook}</p>
        <H>Beats · {b.length_minutes} min</H><ol className="list-decimal space-y-0.5 pl-4 text-ink-2">{b.beats.map((x) => <li key={x}>{x}</li>)}</ol>
      </div>
      <div>
        <H>Titles (pick one)</H>
        <ul className="space-y-1">
          {b.titles.map((t) => (
            <li key={t.title} className="flex items-start gap-2">
              <button className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${picked === t.title ? "bg-accent text-white" : "bg-surface-2 text-ink-2 hover:bg-accent-soft"}`} onClick={async () => { await api(`/api/projects/${projectId}`, "PATCH", { title: t.title }); setPicked(t.title); onTitle(); }}>{picked === t.title ? "✓" : "Use"}</button>
              <span className="text-ink">{t.title} <span className="text-[11px] text-muted">· {t.lever} · {t.title.length} chars</span></span>
            </li>
          ))}
        </ul>
        <H>Thumbnails</H>
        <ul className="space-y-1 text-ink-2">{b.thumbnails.map((t, k) => <li key={k}><b>{k + 1}.</b> {t.image} — “{t.text}” · {t.emotion}</li>)}</ul>
        <H>Search terms to use</H><p className="text-ink-2">{b.search_terms.join(" · ")}</p>
        <H>Shorts to cut from it</H><ul className="list-disc space-y-0.5 pl-4 text-ink-2">{b.shorts.map((x) => <li key={x}>{x}</li>)}</ul>
        {b.risks.length > 0 && (<><H>Risks to check</H><ul className="list-disc space-y-0.5 pl-4 text-warn">{b.risks.map((x) => <li key={x}>{x}</li>)}</ul></>)}
      </div>
    </div>
  );
}
