"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePace } from "../ReadTime";
import { fmtTime } from "@/lib/readtime";

/**
 * Full-screen teleprompter: only the words you say, big, scrolling at your pace.
 * Space = play/pause · ↑/↓ = speed · +/− = text size · M = mirror (for beam-splitter glass).
 */
export function Prompter({ projectId, title, sections }: { projectId: string; title: string; sections: { section: string; lines: string[] }[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(40); // pixels per second
  const [size, setSize] = useState(44);
  const [mirror, setMirror] = useState(false);
  const [showSections, setShowSections] = useState(true);
  const last = useRef<number | null>(null);

  useEffect(() => {
    let raf = 0;
    const tick = (t: number) => {
      if (playing && box.current) {
        if (last.current != null) box.current.scrollTop += ((t - last.current) / 1000) * speed;
        last.current = t;
      } else last.current = null;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); setPlaying((p) => !p); }
      if (e.key === "ArrowUp") setSpeed((s) => Math.min(200, s + 5));
      if (e.key === "ArrowDown") setSpeed((s) => Math.max(5, s - 5));
      if (e.key === "+" || e.key === "=") setSize((s) => Math.min(96, s + 4));
      if (e.key === "-") setSize((s) => Math.max(20, s - 4));
      if (e.key.toLowerCase() === "m") setMirror((m) => !m);
      if (e.key === "Home" && box.current) box.current.scrollTop = 0;
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const [wpm] = usePace();
  const words = sections.flatMap((s) => s.lines).join(" ").split(/\s+/).filter(Boolean).length;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-2 text-[13px]">
        <Link href={`/youtube/make/${projectId}`} className="text-white/70 hover:text-white">← Back</Link>
        <span className="truncate font-semibold">{title}</span>
        <span className="text-white/50">{words} words · ~{fmtTime((words / wpm) * 60)} at your {wpm} wpm</span>
        <span className="ml-auto flex flex-wrap items-center gap-3">
          <button className="rounded-full bg-white px-3 py-1 font-semibold text-black" onClick={() => setPlaying((p) => !p)}>{playing ? "Pause" : "Play"} (space)</button>
          <label className="flex items-center gap-1 text-white/70">Speed<input type="range" min={5} max={200} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} /></label>
          <label className="flex items-center gap-1 text-white/70">Size<input type="range" min={20} max={96} value={size} onChange={(e) => setSize(Number(e.target.value))} /></label>
          <label className="flex items-center gap-1 text-white/70"><input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} /> Mirror</label>
          <label className="flex items-center gap-1 text-white/70"><input type="checkbox" checked={showSections} onChange={(e) => setShowSections(e.target.checked)} /> Section names</label>
          <button className="text-white/70 hover:text-white" onClick={() => box.current && (box.current.scrollTop = 0)}>Top</button>
        </span>
      </div>
      <div className="pointer-events-none absolute left-0 right-0 top-[38%] z-10 h-[2px] bg-red-500/40" />
      <div ref={box} className="flex-1 overflow-y-auto px-[8vw] py-[38vh]" style={{ transform: mirror ? "scaleX(-1)" : undefined }} onClick={() => setPlaying((p) => !p)}>
        {sections.map((s, k) => (
          <div key={k} className="mb-[1.2em]">
            {showSections && s.section && <div className="mb-2 font-sans text-[16px] font-semibold uppercase tracking-widest text-red-400/80">{s.section}</div>}
            {s.lines.map((l, j) => <p key={j} className="mb-[0.6em] font-sans font-medium leading-[1.35]" style={{ fontSize: size }}>{l}</p>)}
          </div>
        ))}
        {!sections.length && <p className="text-[24px] text-white/60">No script yet — produce it first.</p>}
        <p className="pt-[20vh] text-center text-[20px] text-white/40">— end —</p>
      </div>
    </div>
  );
}
