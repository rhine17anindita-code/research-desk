"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { Icon } from "../Icon";
import { InlineIdeas } from "./InlineIdeas";
import { pollLive, useLive } from "../LiveWatcher";
import { timeAgo } from "@/lib/format";
import type { LiveStatus, LiveStory } from "@/lib/live";

const INTERVALS: [number, string][] = [[5, "5 min"], [10, "10 min"], [15, "15 min"], [30, "30 min"], [60, "hour"], [0, "off"]];

/**
 * The top of the Studio: when things were last pulled, a refresh-now button, how often the
 * server checks by itself, what arrived since you last looked, and anything spiking.
 */
export function LiveBar({ initial }: { initial: LiveStatus }) {
  const router = useRouter();
  const live = useLive();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [interval, setIntervalMin] = useState(initial.intervalMinutes);
  const [perm, setPerm] = useState<string>("default");
  const loadedIngest = useRef(initial.lastIngestAt);
  const [, tick] = useState(0);

  useEffect(() => {
    loadedIngest.current = initial.lastIngestAt;
  }, [initial.lastIngestAt]);

  // Mark as seen once you've been on the page a little while.
  useEffect(() => {
    const t = setTimeout(() => api("/api/live", "POST", { seen: true }).then(pollLive).catch(() => {}), 20_000);
    const c = setInterval(() => tick((n) => n + 1), 30_000);
    setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    return () => {
      clearTimeout(t);
      clearInterval(c);
    };
  }, []);

  const lastIngestAt = live?.lastIngestAt ?? initial.lastIngestAt;
  const arrived = !!(lastIngestAt && loadedIngest.current && lastIngestAt !== loadedIngest.current);
  const spiking = live?.spiking.length ? live.spiking : initial.spiking;

  const refresh = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const { result } = await api<{ result: { articlesNew: number; clustersNew: number } }>("/api/ingest", "POST", {});
      setMsg(`${result.articlesNew} new item${result.articlesNew === 1 ? "" : "s"}, ${result.clustersNew} new stor${result.clustersNew === 1 ? "y" : "ies"}`);
      await pollLive();
      router.refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="card flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 text-[12.5px]">
        <span className="flex items-center gap-1.5">
          <span className={`inline-block h-2 w-2 rounded-full ${interval ? "animate-pulse bg-ok" : "bg-muted"}`} />
          <span className="text-ink-2">{lastIngestAt ? `Updated ${timeAgo(lastIngestAt)}` : "Not updated yet"}</span>
        </span>
        <label className="flex items-center gap-1 text-muted">
          Checks by itself every
          <select
            className="input !w-auto !rounded-full !py-0 text-[12px]"
            value={interval}
            onChange={async (e) => {
              const m = Number(e.target.value);
              setIntervalMin(m);
              await api("/api/live", "POST", { intervalMinutes: m });
            }}
          >
            {INTERVALS.map(([m, l]) => <option key={m} value={m}>{l}</option>)}
          </select>
        </label>
        {perm !== "unsupported" && perm !== "granted" && (
          <button className="btn-ghost !px-1 !text-[12px] !text-accent" onClick={async () => setPerm(await Notification.requestPermission())}>
            Alert me when something spikes
          </button>
        )}
        {perm === "granted" && <span className="text-muted">Alerts on (while the app is open)</span>}
        <span className="ml-auto flex items-center gap-2">
          {msg && <span className="text-muted">{msg}</span>}
          {arrived && !busy && (
            <button className="chip-accent" onClick={() => { loadedIngest.current = lastIngestAt; router.refresh(); }}>
              New stuff arrived — show it
            </button>
          )}
          <button className="btn !py-1 !text-[12.5px]" disabled={busy} onClick={refresh}>
            <Icon name="refresh" size={13} className={busy ? "animate-spin" : ""} /> {busy ? "Pulling news, shows & videos…" : "Refresh now"}
          </button>
        </span>
      </div>

      {spiking.length > 0 && (
        <div className="rounded-2xl border border-bad/30 bg-bad-soft px-3 py-2.5">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-bad">Spiking now</div>
          <ul className="space-y-1.5">{spiking.map((s) => <SpikeRow key={s.id} s={s} />)}</ul>
        </div>
      )}

      {initial.fresh.length > 0 && (
        <div className="rounded-2xl bg-accent-soft/60 px-3 py-2.5">
          <div className="mb-1 flex flex-wrap items-baseline gap-x-2 text-[12px]">
            <span className="font-semibold text-accent">Since you last looked</span>
            <span className="text-muted">
              {initial.newStories} new stor{initial.newStories === 1 ? "y" : "ies"}
              {initial.newEpisodes ? ` · ${initial.newEpisodes} new talk-show episode${initial.newEpisodes === 1 ? "" : "s"}` : ""}
              {initial.since ? ` · since ${timeAgo(initial.since)}` : ""}
            </span>
          </div>
          <ul className="grid gap-x-4 gap-y-1 md:grid-cols-2">
            {initial.fresh.map((s) => (
              <li key={s.id} className="min-w-0 text-[12.5px]">
                <Link href={`/story/${s.id}`} className="line-clamp-1 text-ink hover:underline">{s.headline}</Link>
                <span className="text-[11px] text-muted">{s.sources} outlets · {s.why} · {timeAgo(s.firstSeenAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SpikeRow({ s }: { s: LiveStory }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <Link href={`/story/${s.id}`} className="text-[13.5px] font-semibold text-ink hover:underline">{s.headline}</Link>
        <span className="text-[11.5px] text-muted">{s.sources} outlets · {s.why} · first seen {timeAgo(s.firstSeenAt)}</span>
        <button className="btn-ghost !px-0 !text-[12px] !text-accent" onClick={() => setOpen((o) => !o)}>
          <Icon name={open ? "up" : "bulb"} size={12} /> {open ? "Close" : "Angles on this"}
        </button>
      </div>
      {open && <div className="mt-1.5"><InlineIdeas payload={{ clusterIds: [s.id] }} label="Ideas from this story" count={3} /></div>}
    </li>
  );
}
