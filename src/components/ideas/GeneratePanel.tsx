"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AiButton } from "../AiButton";
import { CONTENT_FORMATS } from "@/lib/ideation/formats";

/** Ask the AI for a new batch of ideas, optionally steered by format, medium and a direction. */
export function GeneratePanel({ clusterIds, inspirationId, compact = false, label }: { clusterIds?: string[]; inspirationId?: string; compact?: boolean; label?: string }) {
  const router = useRouter();
  const [medium, setMedium] = useState<"" | "visual" | "written">("");
  const [formats, setFormats] = useState<string[]>([]);
  const [focus, setFocus] = useState("");
  const [count, setCount] = useState(8);
  const [open, setOpen] = useState(!compact);

  const payload = {
    count,
    medium: medium || undefined,
    formats: formats.length ? formats : undefined,
    focus: focus.trim() || undefined,
    clusterIds,
    inspirationId,
  };
  const button = (
    <AiButton
      label={label ?? `Generate ${count} ideas`}
      endpoint="/api/ideas/generate"
      payload={payload}
      confirm="always"
      runningLabel="Finding untold angles…"
      onResult={() => router.refresh()}
    />
  );
  if (compact && !open)
    return (
      <div className="flex flex-wrap items-center gap-2">
        {button}
        <button className="btn-ghost !text-[12px]" onClick={() => setOpen(true)}>Options</button>
      </div>
    );
  return (
    <div className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow">New batch</span>
        <select className="input !w-auto !py-1 text-[13px]" value={medium} onChange={(e) => setMedium(e.target.value as typeof medium)}>
          <option value="">Visual + written</option>
          <option value="visual">Visual only (video, shorts, carousels)</option>
          <option value="written">Written only (essays, op-eds, threads…)</option>
        </select>
        <select className="input !w-auto !py-1 text-[13px]" value={count} onChange={(e) => setCount(Number(e.target.value))}>
          {[5, 8, 10, 12].map((n) => <option key={n} value={n}>{n} ideas</option>)}
        </select>
      </div>
      <div className="flex flex-wrap gap-1">
        {CONTENT_FORMATS.filter((f) => !medium || f.medium === medium).map((f) => (
          <button
            key={f.id}
            onClick={() => setFormats((x) => (x.includes(f.id) ? x.filter((y) => y !== f.id) : [...x, f.id]))}
            className={`chip ${formats.includes(f.id) ? "border-accent bg-accent-soft text-accent" : "hover:border-line-strong"}`}
            title={f.craft}
          >
            {f.label}
          </button>
        ))}
        {formats.length > 0 && <button className="btn-ghost !py-0 !text-[12px]" onClick={() => setFormats([])}>Any format</button>}
      </div>
      <input className="input text-[13px]" value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Optional direction, e.g. “Bangladesh economy stories young people would share” or “hidden history behind this week's Middle East news”" />
      {button}
    </div>
  );
}
