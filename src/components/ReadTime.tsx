"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { countWords, DEFAULT_WPM, fmtTime, parseDuration, PACE_PASSAGE, readTime, spokenText, targetFor, wordsToTarget, type Extra } from "@/lib/readtime";

// One shared pace for the whole app (saved in settings), cached in the page.
let paceCache: number | null = null;
const listeners = new Set<(n: number) => void>();
export function usePace(): [number, (n: number) => Promise<void>] {
  const [wpm, setWpm] = useState(paceCache ?? DEFAULT_WPM);
  useEffect(() => {
    listeners.add(setWpm);
    if (paceCache == null) api<{ settings: Record<string, unknown> }>("/api/settings").then((r) => { paceCache = Number(r.settings["voice.wpm"]) || DEFAULT_WPM; listeners.forEach((l) => l(paceCache!)); }).catch(() => null);
    return () => { listeners.delete(setWpm); };
  }, []);
  const save = async (n: number) => {
    const v = Math.round(Math.min(300, Math.max(60, n)));
    paceCache = v;
    listeners.forEach((l) => l(v));
    await api("/api/settings", "PATCH", { "voice.wpm": v });
  };
  return [wpm, save];
}

/**
 * How long the script runs out loud at YOUR pace, plus clips and sound bites, against the target
 * (Shorts: under 3:00; YouTube: the format's length). Updates as you type. Free.
 */
export function ReadTimeBar({ script, contentType, formatLength, timing, onTiming, compact = false }: {
  script: string; contentType: string; formatLength?: string | null; timing?: string; onTiming?: (json: string) => void; compact?: boolean;
}) {
  const [wpm, saveWpm] = usePace();
  const [open, setOpen] = useState<"extras" | "pace" | null>(null);
  const manual: Extra[] = useMemo(() => {
    try { return timing ? ((JSON.parse(timing) as { extras?: Extra[] }).extras ?? []) : []; } catch { return []; }
  }, [timing]);
  const rt = readTime(script, wpm, manual);
  const target = targetFor(contentType, formatLength);
  const fit = target ? wordsToTarget(rt, wpm, target) : null;
  const pct = target ? Math.min(100, (rt.totalSec / target.max) * 100) : 0;
  const state = !target ? "none" : rt.totalSec > target.max ? "over" : rt.totalSec > target.max * 0.92 ? "close" : rt.totalSec < target.min ? "short" : "ok";
  const tone = { over: "bg-bad", close: "bg-warn", short: "bg-accent", ok: "bg-ok", none: "bg-accent" }[state];
  const saveExtras = (list: Extra[]) => onTiming?.(JSON.stringify({ extras: list.filter((e) => !e.auto) }));

  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-serif text-[18px] font-bold text-ink" title="Speech at your pace + clips + short beats between sections">⏱ {fmtTime(rt.totalSec)}</span>
        <span className="text-muted">
          {rt.words} words · {fmtTime(rt.speechSec)} speaking at <button className="text-accent underline decoration-dotted" onClick={() => setOpen(open === "pace" ? null : "pace")}>{wpm} wpm</button>
          {rt.extrasSec > 0 && <> · <button className="text-accent underline decoration-dotted" onClick={() => setOpen(open === "extras" ? null : "extras")}>{fmtTime(rt.extrasSec)} clips & audio</button></>}
          {rt.pausesSec > 0 && ` · ${rt.pausesSec}s beats`}
        </span>
        {target && (
          <span className={`ml-auto rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${state === "over" ? "bg-bad-soft text-bad" : state === "close" ? "bg-warn-soft text-warn" : state === "ok" ? "bg-ok-soft text-ok" : "bg-accent-soft text-accent"}`}>
            {state === "over" ? `${fmtTime(rt.totalSec - target.max)} over — cut ~${fit!.cut} words` : state === "short" ? `Short of ${fmtTime(target.min)} — ~${fit!.short} words to go` : `On target · room for ~${fit!.room} more words`}
          </span>
        )}
      </div>
      {target && (
        <div className="mt-1.5">
          <div className="relative h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="absolute inset-y-0 bg-ok/15" style={{ left: `${(target.min / target.max) * 100}%`, right: 0 }} />
            <div className={`relative h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-0.5 flex justify-between text-[10.5px] text-muted"><span>0:00</span><span>{target.label}{target.hard ? " (hard limit)" : ""}</span><span>{fmtTime(target.max)}</span></div>
        </div>
      )}
      {!compact && (
        <div className="mt-1 flex flex-wrap gap-3 text-[11.5px]">
          <button className="text-accent hover:underline" onClick={() => setOpen(open === "pace" ? null : "pace")}>Measure my reading pace</button>
          {onTiming && <button className="text-accent hover:underline" onClick={() => setOpen(open === "extras" ? null : "extras")}>Clips & other audio ({rt.extras.length})</button>}
        </div>
      )}
      {open === "pace" && <PaceMeter wpm={wpm} onSave={async (n) => { await saveWpm(n); setOpen(null); }} script={script} />}
      {open === "extras" && <ExtrasEditor auto={rt.extras.filter((e) => e.auto)} manual={manual} editable={!!onTiming} onChange={saveExtras} />}
    </div>
  );
}

function PaceMeter({ wpm, onSave, script }: { wpm: number; onSave: (n: number) => void; script: string }) {
  const own = spokenText(script).split(/\s+/).slice(0, 150).join(" ");
  const [text, setText] = useState<"sample" | "own">("sample");
  const passage = text === "own" && countWords(own) >= 40 ? own : PACE_PASSAGE;
  const [start, setStart] = useState<number | null>(null);
  const [result, setResult] = useState<number | null>(null);
  const [typed, setTyped] = useState(String(wpm));
  const [, tick] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  const go = () => { setResult(null); setStart(Date.now()); timer.current = setInterval(() => tick((n) => n + 1), 250); };
  const stop = () => {
    if (!start) return;
    if (timer.current) clearInterval(timer.current);
    const min = (Date.now() - start) / 60000;
    setStart(null);
    setResult(Math.round(countWords(passage) / Math.max(min, 0.05)));
  };
  return (
    <div className="mt-2 rounded-lg bg-surface-2/70 px-3 py-2">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-[12px]">
        <span className="font-semibold text-ink">Measure your pace</span>
        <span className="text-muted">Press Start, read aloud the way you do on camera, press Stop.</span>
        <span className="ml-auto flex gap-1">
          <button className={text === "sample" ? "chip-accent" : "chip"} onClick={() => setText("sample")}>Sample passage</button>
          {countWords(own) >= 40 && <button className={text === "own" ? "chip-accent" : "chip"} onClick={() => setText("own")}>My script</button>}
        </span>
      </div>
      <p className="max-h-40 overflow-y-auto rounded-md bg-surface px-2.5 py-2 text-[14px] leading-relaxed text-ink">{passage}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {start ? <button className="btn-primary !py-1" onClick={stop}>Stop · {((Date.now() - start) / 1000).toFixed(0)}s</button> : <button className="btn-primary !py-1" onClick={go}>{result ? "Again" : "Start"}</button>}
        {result && (
          <>
            <span className="text-[13px]">You read at <b>{result} words a minute</b>{result < 120 ? " — calm and clear" : result > 175 ? " — quick, good for Shorts" : " — a natural explainer pace"}.</span>
            <button className="btn !py-1" onClick={() => onSave(result)}>Use {result} wpm</button>
          </>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-1 whitespace-nowrap text-[12px] text-muted">
          or type it: <input className="input !py-0.5" style={{ width: 64 }} inputMode="numeric" value={typed} onChange={(e) => setTyped(e.target.value)} /> wpm
          <button className="btn !py-0.5" disabled={!Number(typed)} onClick={() => onSave(Number(typed))}>Save</button>
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted">Most explainers land at 140–170 wpm; Shorts often run 170–190. Your pace is saved for every script.</p>
    </div>
  );
}

function ExtrasEditor({ auto, manual, editable, onChange }: { auto: Extra[]; manual: Extra[]; editable: boolean; onChange: (list: Extra[]) => void }) {
  const [label, setLabel] = useState("");
  const [dur, setDur] = useState("");
  const sec = parseDuration(dur);
  return (
    <div className="mt-2 rounded-lg bg-surface-2/70 px-3 py-2 text-[12.5px]">
      <div className="font-semibold text-ink">Clips, sound bites & other audio</div>
      <p className="text-[11.5px] text-muted">Anything that plays while you're not talking. Lines in the script like <code>▸ Clip: PM&apos;s speech (0:20)</code> are counted automatically.</p>
      <ul className="mt-1 space-y-0.5">
        {auto.map((e, k) => <li key={`a${k}`} className="flex gap-2"><span className="w-12 shrink-0 font-mono text-ink">{fmtTime(e.seconds)}</span><span className="text-ink-2">{e.label}</span><span className="ml-auto text-[11px] text-muted">from script</span></li>)}
        {manual.map((e, k) => (
          <li key={`m${k}`} className="flex gap-2">
            <span className="w-12 shrink-0 font-mono text-ink">{fmtTime(e.seconds)}</span><span className="text-ink-2">{e.label}</span>
            {editable && <button className="ml-auto text-muted hover:text-bad" onClick={() => onChange(manual.filter((_, j) => j !== k))}>Remove</button>}
          </li>
        ))}
        {!auto.length && !manual.length && <li className="text-muted">None yet.</li>}
      </ul>
      {editable && (
        <div className="mt-1.5 flex flex-wrap gap-2">
          <input className="input flex-1 !py-1 text-[12.5px]" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Clip of the minister's speech, intro music, interview bite" />
          <input className="input !w-24 !py-1 text-[12.5px]" value={dur} onChange={(e) => setDur(e.target.value)} placeholder="0:20" />
          <button className="btn !py-1" disabled={!sec} onClick={() => { onChange([...manual, { label: label.trim() || "Clip", seconds: sec! }]); setLabel(""); setDur(""); }}>Add</button>
        </div>
      )}
    </div>
  );
}
