"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../api";
import { Icon } from "../Icon";
import { AiButton } from "../AiButton";
import { timeAgo } from "@/lib/format";
import { BLEND, DIALS, type Dials, type Preset } from "@/lib/voice-shared";
import type { VoiceProfile, VoiceSource } from "@/lib/voice";

type Src = Omit<VoiceSource, "text"> & { preview: string | null };

/** Voice Lab: teach the writer how this channel sounds. */
export function VoiceLab({ channel, profile: initial, sources }: { channel: string; profile: VoiceProfile; sources: Src[] }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [saved, setSaved] = useState<string | null>(null);
  const save = async (patch: Partial<VoiceProfile>) => {
    const r = await api<{ profile: VoiceProfile }>("/api/voice", "PATCH", patch);
    setP(r.profile);
    setSaved("Saved");
    setTimeout(() => setSaved(null), 1500);
  };
  const mine = sources.filter((s) => s.kind === "mine");
  const insp = sources.filter((s) => s.kind === "inspiration");
  const waiting = sources.filter((s) => s.status === "queued").length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-serif text-[28px] font-bold tracking-tight">Voice Lab <span className="text-accent">· {channel}</span></h1>
          <p className="max-w-3xl text-[13px] text-muted">
            Teach the writer how you sound. Add your own scripts and videos, plus creators you admire. It studies them, writes a voice guide you can edit, and every script, hook, caption and rewrite follows it — together with your dials, banned phrases, and what you change in its drafts.
          </p>
        </div>
        <span className="text-[12px] text-muted">{saved}</span>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <SourceBox kind="mine" title="You" hint="Your scripts, or links to your videos on YouTube, Instagram, TikTok or Facebook." items={mine} onChange={() => router.refresh()} />
        <SourceBox kind="inspiration" title="Inspirations" hint="Videos or scripts from creators whose style you want to borrow from (Johnny Harris, TLDR, PeekTV, Dylan Page…)." items={insp} onChange={() => router.refresh()} />
      </div>
      {waiting > 0 && (
        <p className="rounded-xl bg-accent-soft px-3 py-2 text-[12.5px] text-ink-2">
          {waiting} video{waiting === 1 ? " is" : "s are"} waiting to be transcribed. The server does this every 10 minutes through the transcript service (Settings → Connections); a long video can take a few minutes.
        </p>
      )}

      <section className="card px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-serif text-[20px] font-semibold">Your voice guide</h2>
            <p className="text-[12.5px] text-muted">
              {p.analysedAt ? `Written ${timeAgo(p.analysedAt)} from your sources — edit anything; your edits are what the writer follows.` : "Add sources above, then let AI study them. You can also write it yourself."}
            </p>
          </div>
          <AiButton label={p.analysedAt ? "Study my sources again" : "Study my sources"} endpoint="/api/voice/analyse" confirm="always" runningLabel="Studying your voice…" onResult={(r) => { setP(r.data as VoiceProfile); router.refresh(); }} />
        </div>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <GuideEditor label="How you sound" value={p.guideMine} onSave={(v) => save({ guideMine: v })} placeholder="e.g. Opens with a question the viewer is already wondering about. Short sentences. Says 'look' before a key point. Uses 'bhai'/'apu' sometimes. Never moralises at the end…" />
          <GuideEditor label="What to borrow from your inspirations" value={p.guideInspiration} onSave={(v) => save({ guideInspiration: v })} placeholder="e.g. Johnny Harris: map-first explanations, a personal 'I went there' moment. TLDR: one-line context, then the twist…" />
        </div>
      </section>

      <Dialboard profile={p} onSave={save} />

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card px-4 py-3">
          <h2 className="font-serif text-[18px] font-semibold">Never say</h2>
          <p className="mb-2 text-[12.5px] text-muted">One phrase per line. Drafts are checked against this and fixed automatically.</p>
          <GuideEditor label="" value={p.banned} onSave={(v) => save({ banned: v })} rows={10} />
        </section>
        <section className="card px-4 py-3">
          <h2 className="font-serif text-[18px] font-semibold">Learning from your edits</h2>
          <p className="text-[12.5px] text-muted">
            Every time you change an AI draft in a project&apos;s Script tab, the before and after are saved. New drafts copy what you did and avoid what you cut.
          </p>
          <p className="mt-2 font-serif text-[26px] font-bold">{p.edits}</p>
          <p className="text-[12px] text-muted">edited script{p.edits === 1 ? "" : "s"} learned from so far</p>
        </section>
      </div>
    </div>
  );
}

function GuideEditor({ label, value, onSave, placeholder, rows = 14 }: { label: string; value: string; onSave: (v: string) => void; placeholder?: string; rows?: number }) {
  const [v, setV] = useState(value);
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    setV(value);
  }
  return (
    <label className="block">
      {label && <span className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-muted">{label}</span>}
      <textarea className="input font-mono text-[12.5px] leading-relaxed" rows={rows} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} />
    </label>
  );
}

function SourceBox({ kind, title, hint, items, onChange }: { kind: "mine" | "inspiration"; title: string; hint: string; items: Src[]; onChange: () => void }) {
  const [mode, setMode] = useState<"link" | "text" | "file">("link");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [creator, setCreator] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const add = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (mode === "file") {
        if (!file) throw new Error("Choose a file");
        const fd = new FormData();
        fd.append("file", file);
        fd.append("kind", kind);
        const r = await fetch("/api/voice/sources", { method: "POST", body: fd });
        const d = await r.json();
        if (!r.ok || d.ok === false) throw new Error(d.message);
      } else await api("/api/voice/sources", "POST", { kind, url: mode === "link" ? url : undefined, text: mode === "text" ? text : undefined, creator: creator || undefined });
      setUrl(""); setText(""); setFile(null);
      onChange();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-serif text-[18px] font-semibold">{title} <span className="text-[13px] font-normal text-muted">({items.length})</span></h2>
        {kind === "mine" && (
          <button className="btn-ghost !px-0 !text-[12px] !text-accent" onClick={async () => { const r = await api<{ added: number }>("/api/voice/import-own", "POST", {}); setErr(r.added ? `Added ${r.added} of your best videos to transcribe` : "Your best videos are already here"); onChange(); }}>
            <Icon name="plus" size={12} /> Add my best videos automatically
          </button>
        )}
      </div>
      <p className="mb-2 text-[12px] text-muted">{hint}</p>
      <div className="mb-2 flex gap-1">
        {(["link", "text", "file"] as const).map((m) => <button key={m} className={mode === m ? "chip-accent" : "chip"} onClick={() => setMode(m)}>{m === "link" ? "Video link" : m === "text" ? "Paste script" : "Text file"}</button>)}
      </div>
      {mode === "link" && <input className="input text-[13px]" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.instagram.com/reel/… · tiktok.com/… · youtube.com/… · facebook.com/…" />}
      {mode === "text" && <textarea className="input min-h-[110px] text-[13px]" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a script or transcript…" />}
      {mode === "file" && <input type="file" accept=".txt,.md,.srt,.vtt" className="text-[13px]" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {kind === "inspiration" && <input className="input !w-48 !py-1 text-[12.5px]" value={creator} onChange={(e) => setCreator(e.target.value)} placeholder="Creator (optional)" />}
        <button className="btn-primary !py-1" disabled={busy} onClick={add}><Icon name="plus" size={13} /> {busy ? "Adding…" : "Add"}</button>
        {err && <span className="text-[12px] text-muted">{err}</span>}
      </div>
      <ul className="mt-3 max-h-[320px] divide-y divide-line overflow-y-auto">
        {items.map((s) => (
          <li key={s.id} className="flex items-start gap-2 py-1.5 text-[12.5px]">
            <span className="chip shrink-0 !text-[10.5px]">{s.platform}</span>
            <div className="min-w-0 flex-1">
              <div className="line-clamp-1 text-ink">{s.title}{s.creator ? <span className="text-muted"> — {s.creator}</span> : null}</div>
              <div className="text-[11px] text-muted">
                {s.status === "queued" ? "Waiting to be transcribed (within ~10 min)…" : s.status === "failed" ? <span className="text-bad">{s.error ?? "Couldn't transcribe"}</span> : `${Math.round(s.chars / 100) / 10}K characters`}
              </div>
            </div>
            <button className="btn-ghost !px-1 !text-muted" title="Remove" onClick={async () => { await api("/api/voice/sources", "DELETE", { id: s.id }); onChange(); }}><Icon name="x" size={12} /></button>
          </li>
        ))}
        {!items.length && <li className="py-2 text-[12px] text-muted">Nothing yet.</li>}
      </ul>
    </section>
  );
}

function Dialboard({ profile, onSave }: { profile: VoiceProfile; onSave: (p: Partial<VoiceProfile>) => void }) {
  const [dials, setDials] = useState<Dials>(profile.dials);
  const [name, setName] = useState("");
  const set = (id: string, v: number) => setDials({ ...dials, [id]: v });
  const commit = () => onSave({ dials });
  const Row = ({ id, left, right, hint }: { id: string; left: string; right: string; hint?: string }) => (
    <label className="block text-[12px]">
      <div className="flex justify-between text-muted"><span>{left}</span>{hint && <span className="text-[11px]">{hint}</span>}<span>{right}</span></div>
      <input type="range" min={0} max={100} value={dials[id] ?? 50} onChange={(e) => set(id, Number(e.target.value))} onMouseUp={commit} onTouchEnd={commit} onKeyUp={commit} className="w-full accent-[var(--color-accent)]" />
    </label>
  );
  return (
    <section className="card px-4 py-4">
      <h2 className="font-serif text-[20px] font-semibold">Dials</h2>
      <p className="mb-3 text-[12.5px] text-muted">The default for this channel. Save combinations as presets (e.g. “Calm explainer”, “Hot take Short”) and pick one when writing.</p>
      <div className="mb-4 rounded-xl bg-accent-soft/60 px-3 py-2"><Row id={BLEND.id} left={BLEND.left} right={BLEND.right} hint="how much to borrow from inspirations" /></div>
      <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">{DIALS.map((d) => <Row key={d.id} id={d.id} left={d.left} right={d.right} hint={d.hint} />)}</div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <input className="input !w-56 !py-1 text-[12.5px]" value={name} onChange={(e) => setName(e.target.value)} placeholder="Preset name" />
        <button className="btn !py-1 !text-[12.5px]" disabled={!name.trim()} onClick={() => { onSave({ presets: [...profile.presets.filter((x) => x.name !== name.trim()), { name: name.trim(), dials }] }); setName(""); }}>Save these dials as a preset</button>
        {profile.presets.map((pr: Preset) => (
          <span key={pr.name} className="chip flex items-center gap-1">
            <button onClick={() => { setDials(pr.dials); onSave({ dials: pr.dials }); }} title="Load">{pr.name}</button>
            <button onClick={() => onSave({ presets: profile.presets.filter((x) => x.name !== pr.name) })} title="Delete" className="text-muted">×</button>
          </span>
        ))}
      </div>
    </section>
  );
}
