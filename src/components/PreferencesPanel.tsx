"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "./api";
import { FORMATS, TOPICS, type Prefs } from "@/lib/prefs-shared";

/** One place to tell the desk what this channel is for: topics, formats, boldness, depth, questions, automatic notes. */
export function PreferencesPanel({ channel, initial, newsRatio: initialRatio, channelId }: { channel: string; initial: Prefs; newsRatio: number; channelId: string }) {
  const [p, setP] = useState(initial);
  const [ratio, setRatio] = useState(initialRatio);
  const [saved, setSaved] = useState<string | null>(null);
  const save = async (patch: Partial<Prefs>) => {
    const r = await api<{ prefs: Prefs }>("/api/prefs", "PATCH", patch);
    setP(r.prefs);
    setSaved("Saved");
    setTimeout(() => setSaved(null), 1200);
  };
  const Slider = ({ value, onChange, onCommit, left, right }: { value: number; onChange: (v: number) => void; onCommit: () => void; left: string; right: string }) => (
    <div>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} onMouseUp={onCommit} onTouchEnd={onCommit} onKeyUp={onCommit} className="w-full accent-[var(--color-accent)]" />
      <div className="flex justify-between text-[11px] text-muted"><span>{left}</span><span>{right}</span></div>
    </div>
  );
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-serif text-[28px] font-bold tracking-tight">Preferences <span className="text-accent">· {channel}</span></h1>
          <p className="max-w-3xl text-[13px] text-muted">What this channel is for. Ideas, story notes, research questions and the strategist all follow these. How scripts <i>sound</i> lives in <Link href="/voice" className="text-accent underline">Voice Lab</Link>; who it&apos;s for and examples you love or hate live in <Link href="/settings?tab=channels" className="text-accent underline">Settings → Channels</Link>.</p>
        </div>
        <span className="text-[12px] text-muted">{saved}</span>
      </header>

      <section className="card px-4 py-4">
        <h2 className="font-serif text-[18px] font-semibold">Topics</h2>
        <p className="mb-3 text-[12.5px] text-muted">How much of each you want. Far left = never.</p>
        <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">
          {TOPICS.map((t) => (
            <label key={t.id} className="block text-[12.5px]">
              <span className="text-ink-2">{t.label}</span>
              <Slider value={p.topics[t.id] ?? 50} onChange={(v) => setP({ ...p, topics: { ...p.topics, [t.id]: v } })} onCommit={() => save({ topics: p.topics })} left="Never" right="As much as possible" />
            </label>
          ))}
        </div>
      </section>

      <section className="card px-4 py-4">
        <h2 className="font-serif text-[18px] font-semibold">Formats</h2>
        <div className="mt-2 grid gap-x-8 gap-y-3 md:grid-cols-2">
          {FORMATS.map((f) => (
            <label key={f.id} className="block text-[12.5px]">
              <span className="text-ink-2">{f.label}</span>
              <Slider value={p.formats[f.id] ?? 30} onChange={(v) => setP({ ...p, formats: { ...p.formats, [f.id]: v } })} onCommit={() => save({ formats: p.formats })} left="None" right="Most of what I make" />
            </label>
          ))}
        </div>
      </section>

      <section className="card px-4 py-4">
        <h2 className="font-serif text-[18px] font-semibold">Style of ideas</h2>
        <div className="mt-2 grid gap-x-8 gap-y-4 md:grid-cols-2">
          <label className="block text-[12.5px]"><span className="text-ink-2">News vs evergreen</span>
            <Slider value={ratio} onChange={setRatio} onCommit={() => api(`/api/channels/${channelId}`, "PATCH", { newsRatio: ratio }).then(() => setSaved("Saved"))} left="Mostly evergreen" right="Mostly today's news" />
          </label>
          <label className="block text-[12.5px]"><span className="text-ink-2">Boldness</span>
            <Slider value={p.boldness} onChange={(v) => setP({ ...p, boldness: v })} onCommit={() => save({ boldness: p.boldness })} left="Safe & balanced" right="Provocative hot takes" />
          </label>
          <label className="block text-[12.5px]"><span className="text-ink-2">Depth</span>
            <Slider value={p.depth} onChange={(v) => setP({ ...p, depth: v })} onCommit={() => save({ depth: p.depth })} left="Quick & light" right="Deep investigations" />
          </label>
          <label className="block text-[12.5px]"><span className="text-ink-2">Research questions</span>
            <Slider value={p.audienceQuestions} onChange={(v) => setP({ ...p, audienceQuestions: v })} onCommit={() => save({ audienceQuestions: p.audienceQuestions })} left="Researcher questions" right="What viewers wonder" />
          </label>
        </div>
        <label className="mt-4 flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={p.notes} onChange={(e) => save({ notes: e.target.checked })} />
          Write editor&apos;s notes automatically for the day&apos;s top stories (cheapest AI model, never more than 8% of the monthly budget)
        </label>
      </section>
    </div>
  );
}
