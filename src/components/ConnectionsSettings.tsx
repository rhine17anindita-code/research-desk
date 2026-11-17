"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";

/** Outside services the server uses on its own — no laptop needed. */
export function ConnectionsSettings({ transcript }: { transcript: { source: "env" | "app" | null; used: number; cap: number } }) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [cap, setCap] = useState(String(transcript.cap));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const save = async (patch: Record<string, unknown>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/connections", "POST", patch);
      setMsg(ok);
      setKey("");
      router.refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <section className="card px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-serif text-[18px] font-semibold">Transcripts & video-to-text</h2>
          <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${transcript.source ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}>{transcript.source ? "Connected" : "Not connected"}</span>
        </div>
        <p className="mt-1 text-[13px] text-ink-2">
          YouTube blocks hosting servers from reading transcripts, so KNDL uses <b>Supadata</b> for talk-show transcripts, Voice Lab videos and Reels/TikToks you save. It runs on the server — nothing depends on your computer.
        </p>
        {transcript.source && <p className="mt-1 text-[12.5px] text-muted">Used {transcript.used} of {transcript.cap} this month.{transcript.source === "env" ? " (Key set in the hosting environment.)" : ""}</p>}
        {!transcript.source && (
          <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-[13px] text-ink-2">
            <li>Go to <a className="text-accent underline" href="https://supadata.ai" target="_blank" rel="noreferrer">supadata.ai</a> and sign up (free, no card — 100 transcripts a month).</li>
            <li>Copy your API key from the dashboard.</li>
            <li>Paste it below and press Save. That&apos;s it.</li>
          </ol>
        )}
        {transcript.source !== "env" && (
          <div className="mt-3 flex flex-wrap gap-2">
            <input className="input flex-1" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder={transcript.source ? "Paste a new key to replace it" : "Paste your Supadata API key"} />
            <button className="btn-primary" disabled={busy || !key.trim()} onClick={() => save({ supadataKey: key }, "Connected — transcripts now come from the server.")}>{busy ? "Checking…" : "Save"}</button>
            {transcript.source === "app" && <button className="btn" disabled={busy} onClick={() => save({ supadataKey: null }, "Disconnected.")}>Disconnect</button>}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
          Use at most <input className="input !py-0.5" style={{ width: 80 }} inputMode="numeric" value={cap} onChange={(e) => setCap(e.target.value)} /> a month
          <button className="btn !py-0.5" disabled={busy} onClick={() => save({ monthlyCap: Number(cap) }, "Saved.")}>Save</button>
          <span>(free plan: 100; raise it if you upgrade)</span>
        </div>
        {msg && <p className="mt-2 text-[12.5px] text-ink-2">{msg}</p>}
      </section>
      <section className="card px-4 py-4 text-[13px] text-ink-2">
        <h2 className="font-serif text-[18px] font-semibold">Also on the server, free</h2>
        <ul className="mt-1 list-disc pl-5">
          <li>News and talk shows refresh every 10 minutes by themselves.</li>
          <li>Bangla headlines are translated to English (free public translation service, a daily allowance).</li>
          <li>Long Bangla transcripts: press “Translate to English” on the episode (cheapest AI model, cost shown first).</li>
          <li>The Mac helper is optional now — if it runs, it adds free offline translation and pages some sites refuse to servers.</li>
        </ul>
      </section>
    </div>
  );
}
