"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../api";
import { Icon } from "../Icon";
import { AiButton } from "../AiButton";
import type { ImportResult } from "@/lib/performance/csv-import";

export function SyncButton({ label = "Sync YouTube now" }: { label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-2">
      {msg && <span className="text-[12px] text-muted">{msg}</span>}
      <button
        className="btn !py-1 !text-[12.5px]"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          try {
            const r = await api<{ result: { videos: number; comments: number } }>("/api/performance/sync", "POST", {});
            setMsg(`${r.result.videos} videos, ${r.result.comments} comments`);
            router.refresh();
          } catch (e) {
            setMsg((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Icon name="refresh" size={13} className={busy ? "animate-spin" : ""} /> {busy ? "Syncing…" : label}
      </button>
    </span>
  );
}

const HOWTO: [string, string, string[]][] = [
  ["instagram", "Instagram", [
    "On a computer, open business.facebook.com (Meta Business Suite) with the account your Instagram is linked to.",
    "Insights → Content. Pick Instagram, choose a date range (e.g. last 90 days).",
    "Press Export data → choose CSV → Export. Drop the file here.",
  ]],
  ["facebook", "Facebook", [
    "Same place: Meta Business Suite → Insights → Content, pick your Facebook Page.",
    "Choose the date range → Export data → CSV. Drop the file here.",
  ]],
  ["tiktok", "TikTok", [
    "On a computer, open tiktok.com/tiktokstudio → Analytics.",
    "Use the Download / Export button, choose CSV and the date range. Drop the file here.",
    "If TikTok only gives daily totals, they're still imported as a trend line.",
  ]],
];

/** Import stats exports from Meta Business Suite and TikTok Studio. */
export function ImportPanel({ open: defaultOpen }: { open?: boolean }) {
  const router = useRouter();
  const [platform, setPlatform] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<ImportResult | null>(null);
  const [tab, setTab] = useState("instagram");
  return (
    <details className="card px-4 py-3" open={defaultOpen}>
      <summary className="cursor-pointer font-serif text-[17px] font-semibold">Add Instagram, Facebook & TikTok numbers</summary>
      <p className="mt-1 text-[12.5px] text-muted">Export your stats as a CSV and drop it here. Importing again later updates the numbers — nothing is duplicated. Free.</p>
      <div className="mt-2 flex gap-1">
        {HOWTO.map(([id, l]) => <button key={id} className={tab === id ? "chip-accent" : "chip"} onClick={() => setTab(id)}>How: {l}</button>)}
      </div>
      <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-[12.5px] text-ink-2">
        {HOWTO.find((h) => h[0] === tab)![2].map((s) => <li key={s}>{s}</li>)}
      </ol>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input type="file" accept=".csv,text/csv" className="text-[13px]" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <select className="input !w-auto !py-1 text-[12.5px]" value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="">Platform: work it out</option>
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
          <option value="tiktok">TikTok</option>
          <option value="youtube">YouTube</option>
        </select>
        <button
          className="btn-primary"
          disabled={!file || busy}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            setRes(null);
            try {
              const fd = new FormData();
              fd.append("file", file!);
              if (platform) fd.append("platform", platform);
              const r = await fetch("/api/performance/import", { method: "POST", body: fd });
              const d = await r.json();
              if (!r.ok || d.ok === false) throw new Error(d.message || "Import failed");
              setRes(d.result);
              router.refresh();
            } catch (e) {
              setErr((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Icon name="plus" size={14} /> {busy ? "Importing…" : "Import"}
        </button>
      </div>
      {err && <p className="mt-2 text-[12.5px] text-bad">{err}</p>}
      {res && (
        <div className="mt-2 rounded-xl bg-ok-soft px-3 py-2 text-[12.5px] text-ink-2">
          Imported {res.rows} {res.kind === "posts" ? "posts" : "days"} ({Object.entries(res.platforms).map(([p, n]) => `${p} ${n}`).join(", ")})
          {res.from ? `, ${res.from.slice(0, 10)} to ${res.to?.slice(0, 10)}` : ""}{res.skipped ? `, ${res.skipped} rows skipped` : ""}.
          <div className="mt-0.5 text-[11.5px] text-muted">Read: {res.recognised.join(", ")}.{res.ignored.length ? ` Not used: ${res.ignored.slice(0, 10).join(", ")}${res.ignored.length > 10 ? "…" : ""}.` : ""}</div>
        </div>
      )}
    </details>
  );
}

export function StrategyButton({ has }: { has: boolean }) {
  const router = useRouter();
  const [direction, setDirection] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input className="input !w-full !py-1 text-[13px] sm:!w-72" value={direction} onChange={(e) => setDirection(e.target.value)} placeholder="Ask it something (optional): e.g. should I do more long videos?" />
      <AiButton label={has ? "Write a new report" : "Write my strategy report"} endpoint="/api/performance/strategy" payload={{ direction: direction || undefined }} confirm="always" runningLabel="Reading your numbers…" onResult={() => router.refresh()} />
    </div>
  );
}

export function CommentsButton({ has }: { has: boolean }) {
  const router = useRouter();
  return <AiButton label={has ? "Read the comments again" : "Read my comments"} endpoint="/api/performance/comments" confirm="always" runningLabel="Reading comments…" onResult={() => router.refresh()} size="sm" />;
}
