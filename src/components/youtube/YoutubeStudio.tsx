"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../api";
import { MakeVideo, type ProductionRow } from "./MakeVideo";
import { Icon } from "../Icon";
import { DIAGNOSIS, FORMATS, KIT_UPGRADES, LAUNCH, RULES, SET_GUIDE, THUMBNAIL_RULES, WORKFLOW, type GuideSection } from "@/lib/youtube/guide";
import type { Competitor, CompVideo, WeekBlock, YppProgress, YtChannel } from "@/lib/youtube";

interface Data {
  channels: YtChannel[]; selected: string | null; progress: YppProgress | null; plan: { blocks: WeekBlock[]; summary: string; rules: string[] };
  competitors: Competitor[]; breakouts: CompVideo[]; launchChecks: string[]; setChecks: string[]; suggestions: { name: string; id: string }[];
  productions: ProductionRow[];
}
type Tab = "make" | "plan" | "channels" | "formats" | "set" | "workflow" | "competitors" | "optimise" | "rules";
const TABS: [Tab, string][] = [["make", "Make a video"], ["plan", "Plan & progress"], ["channels", "Channels"], ["formats", "Formats"], ["set", "Set, light & sound"], ["workflow", "Workflow"], ["competitors", "Competitors & missed angles"], ["optimise", "Titles & thumbnails"], ["rules", "Rules"]];
const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K` : String(n));

/** YouTube: building, growing and optimising channels from scratch. */
export function YoutubeStudio({ initialTab = "make" }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [yt, setYt] = useState<string | null>(null);
  const [d, setD] = useState<Data | null>(null);
  const load = (id = yt) => api<Data>(`/api/youtube${id ? `?yt=${id}` : ""}`).then((r) => { setD(r); setYt(r.selected); });
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!d) return <p className="text-[13px] text-muted">Loading…</p>;
  const cur = d.channels.find((c) => c.id === d.selected) ?? null;
  const check = async (scope: string, key: string, done: boolean) => {
    await api("/api/youtube/checks", "POST", { scope, key, done });
    load();
  };
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-[28px] font-bold tracking-tight">YouTube</h1>
          <p className="max-w-3xl text-[13px] text-muted">Build, grow and monetise your channels: the plan, the formats you can make solo, the set, the workflow from idea to upload, competitors and missed angles, packaging and the rules. Projects carry the format, checklist and review.</p>
        </div>
        <select className="input !w-auto !py-1 text-[13px]" value={d.selected ?? ""} onChange={(e) => load(e.target.value)}>
          {d.channels.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.status}</option>)}
        </select>
      </header>
      <div className="flex flex-wrap gap-1">{TABS.map(([t, l]) => <button key={t} className={tab === t ? "chip-accent" : "chip"} onClick={() => setTab(t)}>{l}</button>)}</div>
      {tab === "make" && cur && <MakeVideo ytChannelId={cur.id} channelName={cur.name} productions={d.productions} />}
      {tab === "plan" && cur && <Plan d={d} cur={cur} reload={load} />}
      {tab === "channels" && <Channels d={d} reload={load} check={check} />}
      {tab === "formats" && <Formats cur={cur} reload={load} />}
      {tab === "set" && <Checklists sections={SET_GUIDE} done={d.setChecks} scope="set" check={check} extra={<Kit />} />}
      {tab === "workflow" && <Workflow />}
      {tab === "competitors" && cur && <Competitors d={d} cur={cur} reload={load} />}
      {tab === "optimise" && <Optimise />}
      {tab === "rules" && <Rules />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Bar({ label, value, target, unit }: { label: string; value: number | null; target: number; unit: string }) {
  const pct = value == null ? 0 : Math.min(100, (value / target) * 100);
  return (
    <div className="text-[12.5px]">
      <div className="flex justify-between"><span className="text-ink-2">{label}</span><span className="tabular-nums text-muted">{value == null ? "enter below" : `${fmt(Math.round(value))} / ${fmt(target)} ${unit}`}</span></div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function Plan({ d, cur, reload }: { d: Data; cur: YtChannel; reload: () => void }) {
  const p = d.progress!;
  const [views, setViews] = useState(2000);
  const [avd, setAvd] = useState(4);
  const [perWeek, setPerWeek] = useState(1);
  const hoursPerWeek = (views * avd * perWeek) / 60;
  const have = cur.watchHours ?? 0;
  const weeks = hoursPerWeek > 0 ? Math.ceil(Math.max(0, 4000 - have) / hoursPerWeek) : null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card space-y-3 px-4 py-4">
        <h2 className="font-serif text-[18px] font-semibold">Road to monetisation · {cur.name}</h2>
        <Bar label="Subscribers" value={p.subscribers} target={1000} unit="" />
        <Bar label="Public watch hours (last 12 months)" value={cur.watchHours} target={4000} unit="h" />
        <Bar label="…or Shorts views (last 90 days, estimate)" value={p.shortsViews90d} target={10_000_000} unit="" />
        <label className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
          Your watch hours from YouTube Studio → Earn:
          <input type="number" className="input !w-28 !py-0.5" defaultValue={cur.watchHours ?? ""} onBlur={(e) => api("/api/youtube/channels", "POST", { id: cur.id, data: { watchHours: e.target.value === "" ? null : Number(e.target.value) } }).then(reload)} />
        </label>
        <p className="text-[12.5px] text-ink-2">
          {p.longVideos} long videos and {p.shorts} Shorts so far{p.lastUpload ? `, last upload ${p.lastUpload.slice(0, 10)}` : ""}. {p.longVideos === 0 ? "Watch hours only come from long videos — the first job is a weekly long video." : ""}
        </p>
        <div className="rounded-xl bg-accent-soft/50 p-3 text-[12.5px]">
          <div className="mb-1 font-semibold text-ink">How long to 4,000 hours?</div>
          <div className="grid grid-cols-3 gap-2">
            <label>Views per long video<input type="number" className="input !py-0.5" value={views} onChange={(e) => setViews(Number(e.target.value))} /></label>
            <label>Avg minutes watched<input type="number" step="0.5" className="input !py-0.5" value={avd} onChange={(e) => setAvd(Number(e.target.value))} /></label>
            <label>Long videos a week<input type="number" step="0.5" className="input !py-0.5" value={perWeek} onChange={(e) => setPerWeek(Number(e.target.value))} /></label>
          </div>
          <p className="mt-2 text-ink-2">≈ {Math.round(hoursPerWeek)} watch hours a week from new videos → about <b>{weeks ?? "—"} weeks</b>. Older videos keep adding hours, so it&apos;s usually faster. Cross-promoting each video to your 40K Facebook/Instagram followers is the biggest lever.</p>
        </div>
      </section>
      <section className="card px-4 py-4">
        <h2 className="font-serif text-[18px] font-semibold">Your week (solo, ~20 hours)</h2>
        <p className="mb-2 text-[12.5px] text-muted">{d.plan.summary}</p>
        <ul className="space-y-1.5 text-[12.5px]">
          {d.plan.blocks.map((b) => (
            <li key={b.day} className="flex gap-3"><span className="w-20 shrink-0 font-semibold text-ink">{b.day}</span><span className="flex-1 text-ink-2">{b.tasks.join(" · ")}</span><span className="shrink-0 tabular-nums text-muted">{b.hours}h</span></li>
          ))}
        </ul>
        <h3 className="mb-1 mt-4 text-[12px] font-semibold uppercase tracking-wide text-muted">Rules for this plan</h3>
        <ul className="list-disc space-y-1 pl-4 text-[12.5px] text-ink-2">{d.plan.rules.map((r) => <li key={r}>{r}</li>)}</ul>
        <div className="mt-3 flex flex-wrap gap-3 text-[12.5px]">
          <Link href="/studio" className="text-accent hover:underline">Pick this week&apos;s story →</Link>
          <Link href="/calendar" className="text-accent hover:underline">Calendar →</Link>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Channels({ d, reload, check }: { d: Data; reload: () => void; check: (scope: string, key: string, done: boolean) => void }) {
  const [name, setName] = useState("");
  return (
    <div className="space-y-4">
      {d.channels.map((c) => <ChannelCard key={c.id} c={c} done={c.id === d.selected ? d.launchChecks : null} reload={reload} check={check} />)}
      <div className="card flex flex-wrap items-center gap-2 px-4 py-3 text-[12.5px]">
        <span className="font-semibold">Add a channel</span>
        <input className="input !w-64 !py-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name or working title" />
        <button className="btn-primary !py-1" disabled={!name.trim()} onClick={async () => { await api("/api/youtube/channels", "POST", { data: { name, status: "later" } }); setName(""); reload(); }}>Add</button>
      </div>
    </div>
  );
}

function ChannelCard({ c, done, reload, check }: { c: YtChannel; done: string[] | null; reload: () => void; check: (scope: string, key: string, done: boolean) => void }) {
  const save = (data: Partial<YtChannel>) => api("/api/youtube/channels", "POST", { id: c.id, data }).then(reload);
  const T = ({ k, label, rows = 2 }: { k: "positioning" | "audience" | "cadence" | "notes" | "niche"; label: string; rows?: number }) => (
    <label className="block text-[12px]"><span className="text-muted">{label}</span><textarea rows={rows} className="input text-[12.5px]" defaultValue={c[k]} onBlur={(e) => e.target.value !== c[k] && save({ [k]: e.target.value } as Partial<YtChannel>)} /></label>
  );
  return (
    <section className="card px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <input className="input !w-auto !py-0.5 font-serif text-[18px] font-semibold" defaultValue={c.name} onBlur={(e) => e.target.value !== c.name && save({ name: e.target.value })} />
        <input className="input !w-40 !py-0.5 text-[12.5px]" defaultValue={c.handle} placeholder="@handle" onBlur={(e) => e.target.value !== c.handle && save({ handle: e.target.value })} />
        <select className="input !w-auto !py-0.5 text-[12.5px]" value={c.status} onChange={(e) => save({ status: e.target.value })}>{["active", "launching", "planned", "later"].map((s) => <option key={s}>{s}</option>)}</select>
        <button className="ml-auto text-[12px] text-muted hover:text-bad" onClick={() => confirm(`Remove ${c.name}?`) && api("/api/youtube/channels", "DELETE", { id: c.id }).then(reload)}>Remove</button>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <T k="niche" label="Niche" rows={1} />
        <T k="cadence" label="Cadence" rows={1} />
        <T k="positioning" label="Promise (one sentence a viewer would repeat)" />
        <T k="audience" label="Who it's for" />
        <label className="block text-[12px]"><span className="text-muted">Pillars / series (one per line)</span><textarea rows={4} className="input text-[12.5px]" defaultValue={c.pillars.join("\n")} onBlur={(e) => save({ pillars: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })} /></label>
        <T k="notes" label="Strategy notes" rows={4} />
      </div>
      <div className="mt-2 text-[12px] text-muted">Formats: {c.formats.map((f) => FORMATS.find((x) => x.id === f)?.name.split(" (")[0] ?? f).join(" · ") || "none yet — pick in Formats"}</div>
      {done && (
        <details className="mt-3" open={c.status !== "active"}>
          <summary className="cursor-pointer text-[13px] font-semibold text-accent">Launch checklist ({LAUNCH.filter((l) => done.includes(l.key)).length}/{LAUNCH.length})</summary>
          <ul className="mt-2 space-y-1.5">
            {LAUNCH.map((l) => (
              <li key={l.key} className="flex gap-2 text-[12.5px]">
                <input type="checkbox" className="mt-0.5" checked={done.includes(l.key)} onChange={(e) => check(`launch:${c.id}`, l.key, e.target.checked)} />
                <span><span className="text-ink">{l.text}</span>{l.why && <span className="text-muted"> — {l.why}</span>}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {!done && <p className="mt-2 text-[11.5px] text-muted">Select this channel at the top to see its launch checklist.</p>}
    </section>
  );
}

// ---------------------------------------------------------------------------

function Formats({ cur, reload }: { cur: YtChannel | null; reload: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (id: string) => cur && api("/api/youtube/channels", "POST", { id: cur.id, data: { formats: cur.formats.includes(id) ? cur.formats.filter((f) => f !== id) : [...cur.formats, id] } }).then(reload);
  return (
    <div className="space-y-2">
      <p className="text-[12.5px] text-muted">Formats you can make solo with your camera, mic, lights and CapCut. Hours are per video once you&apos;ve made a few. Tick the ones {cur?.name ?? "this channel"} uses; set a project&apos;s format in its YouTube panel and the script follows that structure.</p>
      {FORMATS.map((f) => (
        <article key={f.id} className="card px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {cur && <input type="checkbox" checked={cur.formats.includes(f.id)} onChange={() => toggle(f.id)} title={`Use on ${cur.name}`} />}
            <button className="flex-1 text-left font-serif text-[16px] font-semibold text-ink" onClick={() => setOpen(open === f.id ? null : f.id)}>{f.name}</button>
            <span className="chip !text-[11px]">{f.length}</span>
            <span className="chip !text-[11px]">~{f.hours}h</span>
            <span className={`chip !text-[11px] ${f.difficulty === "hard" ? "text-warn" : f.difficulty === "easy" ? "text-ok" : ""}`}>{f.difficulty}</span>
          </div>
          <p className="mt-1 text-[12.5px] text-ink-2">{f.what}</p>
          {open === f.id && (
            <div className="mt-2 grid gap-3 text-[12.5px] md:grid-cols-2">
              <div><b>Why it works:</b> {f.why}<div className="mt-1"><b>For monetisation:</b> {f.ypp}</div><div className="mt-1"><b>Kit:</b> {f.kit.join(" · ")}</div><div className="mt-1"><b>Like:</b> {f.examples}</div></div>
              <div><b>Structure</b><ol className="mt-1 list-decimal space-y-0.5 pl-4">{f.structure.map((s) => <li key={s}>{s}</li>)}</ol></div>
              <div><b>Editing in CapCut</b><ul className="mt-1 list-disc space-y-0.5 pl-4">{f.edit.map((s) => <li key={s}>{s}</li>)}</ul></div>
              <div><b>Thumbnail:</b> {f.thumbnail}<div className="mt-1"><b>Title patterns</b><ul className="list-disc pl-4">{f.titles.map((t) => <li key={t}>{t}</li>)}</ul></div></div>
            </div>
          )}
          {open !== f.id && <button className="mt-1 text-[12px] text-accent hover:underline" onClick={() => setOpen(f.id)}>Structure, editing, thumbnail & titles</button>}
        </article>
      ))}
    </div>
  );
}

function Checklists({ sections, done, scope, check, extra }: { sections: GuideSection[]; done: string[]; scope: string; check: (s: string, k: string, d: boolean) => void; extra?: React.ReactNode }) {
  const total = sections.reduce((n, s) => n + s.checks.length, 0);
  return (
    <div className="space-y-3">
      <p className="text-[12.5px] text-muted">Do this once, tick as you go ({done.length}/{total}). Then setup before each shoot is about 15 minutes.</p>
      <div className="grid gap-3 lg:grid-cols-2">
        {sections.map((s) => (
          <section key={s.id} className="card px-4 py-3">
            <h2 className="font-serif text-[17px] font-semibold">{s.title}</h2>
            <p className="mb-2 text-[12.5px] text-muted">{s.intro}</p>
            <ul className="space-y-1.5">
              {s.checks.map((c) => (
                <li key={c.key} className="flex gap-2 text-[12.5px]">
                  <input type="checkbox" className="mt-0.5" checked={done.includes(c.key)} onChange={(e) => check(scope, c.key, e.target.checked)} />
                  <span><span className="text-ink">{c.text}</span>{c.why && <span className="text-muted"> — {c.why}</span>}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {extra}
    </div>
  );
}

function Kit() {
  return (
    <section className="card px-4 py-3">
      <h2 className="font-serif text-[17px] font-semibold">Upgrades worth making (you already have camera, mic and lights)</h2>
      <ul className="mt-2 space-y-1.5 text-[12.5px]">{KIT_UPGRADES.map((k) => <li key={k.item}><b className="text-ink">{k.item}</b> <span className="text-ink-2">— {k.why}</span> <span className="chip !text-[10.5px]">{k.when}</span></li>)}</ul>
    </section>
  );
}

function Workflow() {
  return (
    <div className="space-y-3">
      <p className="text-[12.5px] text-muted">The whole process from idea to review. Each project&apos;s YouTube panel has this checklist to tick for that video.</p>
      <div className="grid gap-3 lg:grid-cols-2">
        {WORKFLOW.map((s) => (
          <section key={s.id} className="card px-4 py-3">
            <h2 className="font-serif text-[16px] font-semibold">{s.title}</h2>
            <p className="mb-1.5 text-[12.5px] text-muted">{s.intro}</p>
            <ul className="list-disc space-y-0.5 pl-4 text-[12.5px] text-ink-2">{s.checks.map((c) => <li key={c.key}>{c.text}</li>)}</ul>
          </section>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Competitors({ d, cur, reload }: { d: Data; cur: YtChannel; reload: () => void }) {
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [missed, setMissed] = useState<{ id: string; headline: string; why: string; sources: number }[] | null>(null);
  useEffect(() => {
    api<{ missed: typeof missed }>(`/api/youtube/missed?yt=${cur.id}`).then((r) => setMissed(r.missed)).catch(() => setMissed([]));
  }, [cur.id, d.competitors.length]);
  const add = async (l: string) => {
    setBusy(true);
    setErr(null);
    try {
      await api("/api/youtube/competitors", "POST", { ytChannelId: cur.id, link: l });
      setLink("");
      reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const tracked = new Set(d.competitors.map((c) => c.youtubeId));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card space-y-2 px-4 py-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-[18px] font-semibold">Competitors for {cur.name}</h2>
          {d.competitors.length > 0 && <button className="btn !py-1 !text-[12px]" disabled={busy} onClick={async () => { setBusy(true); await api("/api/youtube/competitors", "PATCH", { ytChannelId: cur.id }); setBusy(false); reload(); }}><Icon name="refresh" size={12} className={busy ? "animate-spin" : ""} /> Refresh</button>}
        </div>
        <div className="flex gap-2">
          <input className="input text-[12.5px]" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Channel link or @handle" />
          <button className="btn-primary !py-1" disabled={!link.trim() || busy} onClick={() => add(link)}>{busy ? "Adding…" : "Track"}</button>
        </div>
        {err && <p className="text-[12px] text-bad">{err}</p>}
        <ul className="divide-y divide-line text-[12.5px]">
          {d.competitors.map((c) => (
            <li key={c.id} className="flex items-center gap-2 py-1.5">
              <a href={`https://www.youtube.com/channel/${c.youtubeId}`} target="_blank" rel="noreferrer" className="flex-1 text-ink hover:underline">{c.name}</a>
              <span className="text-muted">{c.videos} videos · typical {fmt(c.median)} views</span>
              <button className="text-muted hover:text-bad" onClick={() => api("/api/youtube/competitors", "DELETE", { id: c.id }).then(reload)}>×</button>
            </li>
          ))}
        </ul>
        {d.suggestions.filter((s) => s.id && !tracked.has(s.id)).length > 0 && (
          <div className="text-[12px]">
            <span className="text-muted">From your reference creators: </span>
            {d.suggestions.filter((s) => s.id && !tracked.has(s.id)).map((s) => <button key={s.id} className="chip mr-1 mt-1 !text-[11px]" onClick={() => add(s.id)}>+ {s.name}</button>)}
          </div>
        )}
        <p className="text-[11.5px] text-muted">Also add 3–5 channels your size or a little bigger in your niche — they show what works for an audience like yours.</p>
      </section>
      <section className="card px-4 py-4">
        <h2 className="font-serif text-[18px] font-semibold">Missed angles</h2>
        <p className="mb-2 text-[12.5px] text-muted">Big stories on your Desk right now that none of your competitors covered in the last 30 days.</p>
        {missed === null ? <p className="text-[12.5px] text-muted">Checking…</p> : missed.length ? (
          <ul className="space-y-1.5 text-[12.5px]">{missed.map((m) => <li key={m.id}><Link href={`/story/${m.id}`} className="font-medium text-ink hover:underline">{m.headline}</Link><div className="text-[11.5px] text-muted">{m.sources} outlets · {m.why}</div></li>)}</ul>
        ) : <p className="text-[12.5px] text-muted">{cur.deskChannelId ? "None right now — or add competitors first." : "Link this channel to a Desk channel to see stories."}</p>}
      </section>
      <section className="card px-4 py-4 lg:col-span-2">
        <h2 className="font-serif text-[18px] font-semibold">Proven topics: their breakout videos</h2>
        <p className="mb-2 text-[12.5px] text-muted">Videos that beat that channel&apos;s usual views by 1.8× or more. The topic is proven; your job is a better angle and a Bangladesh lens.</p>
        <div className="grid gap-2 md:grid-cols-2">
          {d.breakouts.map((v) => (
            <a key={v.videoId} href={v.url} target="_blank" rel="noreferrer" className="flex gap-2.5 rounded-lg p-1 hover:bg-surface-2">
              {v.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.thumbnail} alt="" className="h-[54px] w-[96px] shrink-0 rounded-md object-cover" referrerPolicy="no-referrer" />
              )}
              <span className="min-w-0 text-[12.5px]">
                <span className="line-clamp-2 font-medium text-ink">{v.title}</span>
                <span className="text-[11.5px] text-muted">{v.competitor} · {fmt(v.views)} views · <b className="text-ok">{v.multiple.toFixed(1)}×</b> their usual</span>
              </span>
            </a>
          ))}
          {!d.breakouts.length && <p className="text-[12.5px] text-muted">Track some competitors to see what's breaking out.</p>}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Optimise() {
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [r, setR] = useState<{ checks: { ok: boolean; text: string }[]; score: number; suggestions: string[] } | null>(null);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card space-y-2 px-4 py-4">
        <h2 className="font-serif text-[18px] font-semibold">Title lab</h2>
        <input className="input text-[13px]" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Your title" />
        <input className="input text-[13px]" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic people search (e.g. hasina extradition)" />
        <button className="btn-primary !py-1" onClick={async () => setR(await api("/api/youtube/title", "POST", { title, topic }))}>Check</button>
        {r && (
          <div className="space-y-2 text-[12.5px]">
            {title && <div><b>Score {r.score}/100</b><ul className="mt-1 space-y-0.5">{r.checks.map((c) => <li key={c.text} className={c.ok ? "text-ok" : "text-warn"}>{c.ok ? "✓" : "•"} {c.text}</li>)}</ul></div>}
            {r.suggestions.length > 0 && <div><b>What people search on YouTube</b><ul className="mt-1 flex flex-wrap gap-1">{r.suggestions.map((s) => <li key={s} className="chip !text-[11px]">{s}</li>)}</ul><p className="mt-1 text-[11.5px] text-muted">Use their words in the title and the first line of the description.</p></div>}
          </div>
        )}
      </section>
      <section className="card px-4 py-4">
        <h2 className="font-serif text-[18px] font-semibold">Thumbnail rules</h2>
        <ul className="mt-1 list-disc space-y-1 pl-4 text-[12.5px] text-ink-2">{THUMBNAIL_RULES.map((t) => <li key={t}>{t}</li>)}</ul>
        <h2 className="mt-4 font-serif text-[18px] font-semibold">Reading your numbers</h2>
        <ul className="mt-1 space-y-1.5 text-[12.5px]">{DIAGNOSIS.map((x) => <li key={x.metric}><b className="text-ink">{x.metric}</b> <span className="text-muted">— if {x.low.toLowerCase()}:</span> <span className="text-ink-2">{x.fix}</span></li>)}</ul>
        <p className="mt-2 text-[11.5px] text-muted">Click-through rate, retention and watch time are in YouTube Studio → Analytics. Record them in each project&apos;s YouTube panel for an automatic diagnosis.</p>
      </section>
    </div>
  );
}

function Rules() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {RULES.map((r) => (
        <section key={r.title} className="card px-4 py-3">
          <h2 className="font-serif text-[16px] font-semibold">{r.title}</h2>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-[12.5px] text-ink-2">{r.points.map((p) => <li key={p}>{p}</li>)}</ul>
        </section>
      ))}
    </div>
  );
}
