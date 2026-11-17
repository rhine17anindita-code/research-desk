"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Icon } from "../Icon";
import { GOAL_LABEL, KIND_LABEL, SPONSOR_CATEGORIES, type Goal, type PlayKind } from "@/lib/monetise/library";
import type { MonItem, MonProposal, MonSeries, MonSettings, MonSponsor, RateLine } from "@/lib/monetise";

interface Data {
  settings: MonSettings;
  items: MonItem[];
  sponsors: MonSponsor[];
  series: MonSeries[];
  proposals: MonProposal[];
  rates: { lines: RateLine[]; reach: { platform: string; followers: number | null; typical: number; metric: string }[]; note: string };
}
type Tab = "plan" | "playbook" | "sponsors" | "series" | "proposals";
const TABS: [Tab, string][] = [["plan", "Goals & rates"], ["playbook", "Playbook"], ["sponsors", "Sponsors"], ["series", "Series to sell"], ["proposals", "Proposals"]];
const STATUSES = ["idea", "contacted", "talking", "won", "lost", "not-for-me"];
const bdt = (n: number) => `৳${Math.round(n).toLocaleString("en-IN")}`;

/** Monetisation: a content manager's toolkit with no AI — your editable library, sponsors, series, rates and proposals. */
export function MonetiseApp({ channel, initialTab = "plan", projects }: { channel: string; initialTab?: Tab; projects: { id: string; title: string }[] }) {
  const [d, setD] = useState<Data | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [draft, setDraft] = useState<{ sponsorId?: string; seriesId?: string; projectId?: string }>({});
  const load = () => api<Data>("/api/monetise").then(setD);
  useEffect(() => {
    load();
  }, []);
  const entry = async (method: "POST" | "PATCH" | "DELETE", kind: string, payload: Record<string, unknown>) => {
    await api("/api/monetise/entries", method, { kind, ...payload });
    await load();
  };
  const propose = (p: { sponsorId?: string; seriesId?: string; projectId?: string }) => {
    setDraft(p);
    setTab("proposals");
  };
  if (!d) return <p className="text-[13px] text-muted">Loading…</p>;
  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-serif text-[28px] font-bold tracking-tight">Monetise <span className="text-accent">· {channel}</span></h1>
        <p className="max-w-3xl text-[13px] text-muted">
          Ways to grow and earn from what you make — chosen to fit your goals, protect your audience&apos;s experience, and appeal to Bangladeshi brands. Everything here is yours to edit, star, hide or add to. No AI is used on this page.
        </p>
      </header>
      <div className="flex flex-wrap gap-1">{TABS.map(([t, l]) => <button key={t} className={tab === t ? "chip-accent" : "chip"} onClick={() => setTab(t)}>{l}</button>)}</div>
      {tab === "plan" && <Plan d={d} onSaved={load} />}
      {tab === "playbook" && <Playbook items={d.items} goals={d.settings.goals} entry={entry} />}
      {tab === "sponsors" && <Sponsors sponsors={d.sponsors} avoid={d.settings.avoid} entry={entry} propose={propose} />}
      {tab === "series" && <SeriesTab series={d.series} entry={entry} propose={propose} />}
      {tab === "proposals" && <Proposals d={d} projects={projects} draft={draft} entry={entry} reload={load} />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Plan({ d, onSaved }: { d: Data; onSaved: () => void }) {
  const [s, setS] = useState(d.settings);
  const [msg, setMsg] = useState<string | null>(null);
  const save = async (patch: Partial<MonSettings>) => {
    const r = await api<{ settings: MonSettings }>("/api/monetise", "PATCH", patch);
    setS(r.settings);
    setMsg("Saved");
    setTimeout(() => setMsg(null), 1200);
    onSaved();
  };
  const rate = (k: "short" | "video" | "carousel", i: 0 | 1, v: number) => {
    const per = { ...s.rates.perThousandViews, [k]: (i === 0 ? [v, s.rates.perThousandViews[k][1]] : [s.rates.perThousandViews[k][0], v]) as [number, number] };
    save({ rates: { ...s.rates, perThousandViews: per } });
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card px-4 py-4">
        <div className="flex items-baseline justify-between"><h2 className="font-serif text-[18px] font-semibold">What you want from your content</h2><span className="text-[12px] text-muted">{msg}</span></div>
        <p className="mb-3 text-[12.5px] text-muted">These decide which ideas come first on every project.</p>
        {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => (
          <label key={g} className="mb-2 block text-[12.5px]">
            <span className="text-ink-2">{GOAL_LABEL[g]}</span>
            <input type="range" min={0} max={100} value={s.goals[g]} onChange={(e) => setS({ ...s, goals: { ...s.goals, [g]: Number(e.target.value) } })} onMouseUp={() => save({ goals: s.goals })} onTouchEnd={() => save({ goals: s.goals })} className="w-full accent-[var(--color-accent)]" />
          </label>
        ))}
        <label className="mt-2 flex items-center gap-2 text-[12.5px]">At most <input type="number" min={0} max={30} className="input !w-16 !py-0.5" value={s.maxSponsoredPerMonth} onChange={(e) => setS({ ...s, maxSponsoredPerMonth: Number(e.target.value) })} onBlur={() => save({ maxSponsoredPerMonth: s.maxSponsoredPerMonth })} /> sponsored posts a month (so your feed doesn&apos;t feel like ads)</label>
        <h3 className="mb-1 mt-4 text-[12px] font-semibold uppercase tracking-wide text-muted">Never take money from</h3>
        <textarea className="input min-h-[120px] text-[12.5px]" value={s.avoid.join("\n")} onChange={(e) => setS({ ...s, avoid: e.target.value.split("\n") })} onBlur={() => save({ avoid: s.avoid.map((x) => x.trim()).filter(Boolean) })} />
        <h3 className="mb-1 mt-4 text-[12px] font-semibold uppercase tracking-wide text-muted">On your proposals</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <input className="input text-[12.5px]" placeholder="Your name" value={s.contactName} onChange={(e) => setS({ ...s, contactName: e.target.value })} onBlur={() => save({ contactName: s.contactName })} />
          <input className="input text-[12.5px]" placeholder="Business email" value={s.contactEmail} onChange={(e) => setS({ ...s, contactEmail: e.target.value })} onBlur={() => save({ contactEmail: s.contactEmail })} />
        </div>
      </section>
      <section className="card px-4 py-4">
        <h2 className="font-serif text-[18px] font-semibold">Your rate card</h2>
        <p className="mb-2 text-[12.5px] text-muted">{d.rates.note}</p>
        {d.rates.reach.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2 text-[12px]">
            {d.rates.reach.map((r) => <span key={r.platform} className="chip">{r.platform}: {r.followers != null ? `${r.followers.toLocaleString()} followers · ` : ""}{r.typical.toLocaleString()} typical {r.metric}</span>)}
          </div>
        )}
        <table className="w-full text-[12.5px]">
          <tbody>
            {d.rates.lines.map((l) => (
              <tr key={l.deliverable} className="border-b border-line align-top last:border-0">
                <td className="py-1.5 pr-2 text-ink">{l.deliverable}<div className="text-[11px] text-muted">{l.basis}</div></td>
                <td className="whitespace-nowrap py-1.5 text-right font-semibold tabular-nums">{bdt(l.low)}–{bdt(l.high)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3 className="mb-1 mt-4 text-[12px] font-semibold uppercase tracking-wide text-muted">Your rates per 1,000 typical views (৳, low–high)</h3>
        {(["short", "video", "carousel"] as const).map((k) => (
          <div key={k} className="mb-1 flex items-center gap-2 text-[12.5px]">
            <span className="w-24 text-ink-2">{k === "short" ? "Shorts/Reels" : k === "video" ? "Long video" : "Carousel"}</span>
            <input type="number" className="input !w-24 !py-0.5" defaultValue={s.rates.perThousandViews[k][0]} onBlur={(e) => rate(k, 0, Number(e.target.value))} />–
            <input type="number" className="input !w-24 !py-0.5" defaultValue={s.rates.perThousandViews[k][1]} onBlur={(e) => rate(k, 1, Number(e.target.value))} />
            <span className="text-[11px] text-muted">min {bdt(s.rates.minimum[k])}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

type Entry = (method: "POST" | "PATCH" | "DELETE", kind: string, payload: Record<string, unknown>) => Promise<void>;

function Playbook({ items, goals, entry }: { items: MonItem[]; goals: Record<Goal, number>; entry: Entry }) {
  const [kind, setKind] = useState<PlayKind | "all">("all");
  const [showHidden, setShowHidden] = useState(false);
  const [adding, setAdding] = useState(false);
  const [n, setN] = useState({ kind: "cta" as PlayKind, title: "", how: "", example: "" });
  const list = items.filter((i) => (kind === "all" || i.kind === kind) && (showHidden || !i.hidden));
  const groups = (Object.keys(KIND_LABEL) as PlayKind[]).filter((k) => kind === "all" || k === kind);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <button className={kind === "all" ? "chip-accent" : "chip"} onClick={() => setKind("all")}>All</button>
        {(Object.keys(KIND_LABEL) as PlayKind[]).map((k) => <button key={k} className={kind === k ? "chip-accent" : "chip"} onClick={() => setKind(k)}>{KIND_LABEL[k]}</button>)}
        <label className="ml-auto flex items-center gap-1 text-[12px] text-muted"><input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} /> show hidden</label>
        <button className="btn !py-1 !text-[12.5px]" onClick={() => setAdding((a) => !a)}><Icon name="plus" size={12} /> Add your own</button>
      </div>
      {adding && (
        <div className="card space-y-2 px-4 py-3">
          <select className="input !w-auto !py-1 text-[12.5px]" value={n.kind} onChange={(e) => setN({ ...n, kind: e.target.value as PlayKind })}>{(Object.keys(KIND_LABEL) as PlayKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select>
          <input className="input text-[13px]" placeholder="Title" value={n.title} onChange={(e) => setN({ ...n, title: e.target.value })} />
          <textarea className="input min-h-[70px] text-[13px]" placeholder="How it works" value={n.how} onChange={(e) => setN({ ...n, how: e.target.value })} />
          <input className="input text-[13px]" placeholder="Example line or use" value={n.example} onChange={(e) => setN({ ...n, example: e.target.value })} />
          <button className="btn-primary !py-1" disabled={!n.title.trim()} onClick={async () => { await entry("POST", "item", { data: { ...n, formats: ["any"], goals: ["grow"], effort: "low", sensitive_ok: true } }); setN({ ...n, title: "", how: "", example: "" }); setAdding(false); }}>Save</button>
        </div>
      )}
      {groups.map((g) => {
        const rows = list.filter((i) => i.kind === g).sort((a, b) => Number(b.starred) - Number(a.starred) || score(b, goals) - score(a, goals));
        if (!rows.length) return null;
        return (
          <section key={g}>
            <h2 className="mb-2 mt-3 font-serif text-[17px] font-semibold">{KIND_LABEL[g]}</h2>
            <div className="grid gap-3 md:grid-cols-2">{rows.map((i) => <PlayCard key={i.id} i={i} entry={entry} />)}</div>
          </section>
        );
      })}
    </div>
  );
}
const score = (i: MonItem, goals: Record<Goal, number>) => i.goals.reduce((n, g) => n + (goals[g] ?? 0), 0) / Math.max(1, i.goals.length);

function PlayCard({ i, entry }: { i: MonItem; entry: Entry }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState({ title: i.title, how: i.how, example: i.example, notes: i.notes });
  return (
    <article className={`card px-3.5 py-3 ${i.hidden ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-2">
        <button title={i.starred ? "Unstar" : "Star: always show first"} className={i.starred ? "text-warn" : "text-muted hover:text-warn"} onClick={() => entry("PATCH", "item", { id: i.id, data: { starred: !i.starred } })}>★</button>
        {edit ? <input className="input flex-1 !py-0.5 text-[13.5px]" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /> : <h3 className="flex-1 text-[14px] font-semibold text-ink">{i.title}</h3>}
      </div>
      {edit ? (
        <div className="mt-1 space-y-1.5">
          <textarea className="input min-h-[80px] text-[12.5px]" value={v.how} onChange={(e) => setV({ ...v, how: e.target.value })} />
          <input className="input text-[12.5px]" value={v.example} onChange={(e) => setV({ ...v, example: e.target.value })} placeholder="Example" />
          <input className="input text-[12.5px]" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} placeholder="Your notes" />
          <button className="btn-primary !py-0.5 !text-[12px]" onClick={async () => { await entry("PATCH", "item", { id: i.id, data: v }); setEdit(false); }}>Save</button>
        </div>
      ) : (
        <>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">{i.how}</p>
          {i.example && <p className="mt-1 text-[12.5px] italic text-muted">{i.example}</p>}
          {i.notes && <p className="mt-1 text-[12px] text-accent">Note: {i.notes}</p>}
        </>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1 text-[10.5px]">
        {i.goals.map((g) => <span key={g} className="chip !text-[10.5px]">{GOAL_LABEL[g]}</span>)}
        {i.formats.map((f) => <span key={f} className="chip !text-[10.5px]">{f}</span>)}
        {i.effort && <span className="chip !text-[10.5px]">{i.effort} effort</span>}
        {!i.sensitiveOk && <span className="chip !text-[10.5px] text-warn">brand-safe topics only</span>}
        <span className="ml-auto flex gap-2 text-[11.5px]">
          <button className="text-muted hover:text-ink" onClick={() => setEdit((e) => !e)}>{edit ? "Cancel" : "Edit"}</button>
          <button className="text-muted hover:text-ink" onClick={() => entry("PATCH", "item", { id: i.id, data: { hidden: !i.hidden } })}>{i.hidden ? "Unhide" : "Hide"}</button>
          <button className="text-muted hover:text-bad" onClick={() => confirm("Delete this idea from your library?") && entry("DELETE", "item", { id: i.id })}>Delete</button>
        </span>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------

function Sponsors({ sponsors, avoid, entry, propose }: { sponsors: MonSponsor[]; avoid: string[]; entry: Entry; propose: (p: { sponsorId: string }) => void }) {
  const [cat, setCat] = useState("all");
  const [n, setN] = useState({ name: "", category: "bank", notes: "" });
  const list = sponsors.filter((s) => cat === "all" || s.category === cat);
  const counts = useMemo(() => Object.fromEntries(STATUSES.map((st) => [st, sponsors.filter((s) => s.status === st).length])), [sponsors]);
  return (
    <div className="space-y-3">
      <p className="text-[12.5px] text-muted">
        A starting list of Bangladeshi brands by category, with what each tends to want. Suggestions, not relationships — move them through your pipeline as you reach out. Pipeline: {STATUSES.map((st) => `${st} ${counts[st]}`).join(" · ")}. Avoiding: {avoid.join(", ") || "nothing"}.
      </p>
      <div className="flex flex-wrap gap-1">
        <button className={cat === "all" ? "chip-accent" : "chip"} onClick={() => setCat("all")}>All</button>
        {Object.entries(SPONSOR_CATEGORIES).map(([k, c]) => <button key={k} className={cat === k ? "chip-accent" : "chip"} onClick={() => setCat(k)}>{c.label}</button>)}
      </div>
      {cat !== "all" && <p className="rounded-xl bg-accent-soft/50 px-3 py-2 text-[12.5px] text-ink-2"><b>What they want:</b> {SPONSOR_CATEGORIES[cat].angle}</p>}
      <div className="grid gap-2 md:grid-cols-2">
        {list.map((s) => (
          <div key={s.id} className="card px-3.5 py-2.5 text-[12.5px]">
            <div className="flex flex-wrap items-center gap-2">
              <b className="text-[13.5px] text-ink">{s.name}</b>
              <span className="chip !text-[10.5px]">{SPONSOR_CATEGORIES[s.category]?.label ?? s.category}</span>
              <select className="input ml-auto !w-auto !py-0 text-[12px]" value={s.status} onChange={(e) => entry("PATCH", "sponsor", { id: s.id, data: { status: e.target.value, lastContact: ["contacted", "talking"].includes(e.target.value) ? new Date().toISOString() : s.lastContact } })}>
                {STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
              </select>
            </div>
            <input className="input mt-1 !py-0.5 text-[12px]" defaultValue={s.notes} onBlur={(e) => e.target.value !== s.notes && entry("PATCH", "sponsor", { id: s.id, data: { notes: e.target.value } })} />
            <input className="input mt-1 !py-0.5 text-[12px]" defaultValue={s.contact} placeholder="Contact (person, email, agency)" onBlur={(e) => e.target.value !== s.contact && entry("PATCH", "sponsor", { id: s.id, data: { contact: e.target.value } })} />
            <div className="mt-1.5 flex gap-3 text-[11.5px]">
              <button className="text-accent hover:underline" onClick={() => propose({ sponsorId: s.id })}>Make a proposal</button>
              <button className="ml-auto text-muted hover:text-bad" onClick={() => confirm(`Remove ${s.name}?`) && entry("DELETE", "sponsor", { id: s.id })}>Remove</button>
            </div>
          </div>
        ))}
      </div>
      <div className="card flex flex-wrap items-center gap-2 px-3.5 py-2.5 text-[12.5px]">
        <span className="font-semibold">Add a brand</span>
        <input className="input !w-48 !py-1" placeholder="Brand name" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} />
        <select className="input !w-auto !py-1" value={n.category} onChange={(e) => setN({ ...n, category: e.target.value })}>{Object.entries(SPONSOR_CATEGORIES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}</select>
        <input className="input !w-64 !py-1" placeholder="Notes" value={n.notes} onChange={(e) => setN({ ...n, notes: e.target.value })} />
        <button className="btn-primary !py-1" disabled={!n.name.trim()} onClick={async () => { await entry("POST", "sponsor", { data: n }); setN({ ...n, name: "", notes: "" }); }}>Add</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function SeriesTab({ series, entry, propose }: { series: MonSeries[]; entry: Entry; propose: (p: { seriesId: string }) => void }) {
  const [n, setN] = useState({ name: "", premise: "" });
  return (
    <div className="space-y-3">
      <p className="text-[12.5px] text-muted">Recurring series are what sponsors buy: repetition for them, a habit for your audience. Edit episodes freely — they&apos;re also great evergreen content ideas.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {series.map((s) => (
          <article key={s.id} className="card px-4 py-3 text-[12.5px]">
            <div className="flex items-center gap-2">
              <h3 className="flex-1 font-serif text-[16px] font-semibold text-ink">{s.name}</h3>
              <select className="input !w-auto !py-0 text-[12px]" value={s.status} onChange={(e) => entry("PATCH", "series", { id: s.id, data: { status: e.target.value } })}>{["idea", "pitching", "sold", "running"].map((x) => <option key={x}>{x}</option>)}</select>
            </div>
            <p className="mt-1 text-ink-2">{s.premise}</p>
            <div className="mt-1 text-[11.5px] text-muted">{s.format}{s.sentiment ? ` · ${s.sentiment}` : ""}</div>
            <textarea className="input mt-2 min-h-[80px] text-[12px]" defaultValue={s.episodes.join("\n")} onBlur={(e) => entry("PATCH", "series", { id: s.id, data: { episodes: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) } })} />
            <p className="mt-1"><b>Sponsor fit:</b> {s.categories.map((c) => SPONSOR_CATEGORIES[c]?.label ?? c).join(", ")}</p>
            <p className="mt-0.5"><b>How the sponsor appears:</b> {s.integration}</p>
            <div className="mt-2 flex gap-3 text-[11.5px]">
              <button className="text-accent hover:underline" onClick={() => propose({ seriesId: s.id })}>Make a proposal</button>
              <button className="ml-auto text-muted hover:text-bad" onClick={() => confirm(`Delete ${s.name}?`) && entry("DELETE", "series", { id: s.id })}>Delete</button>
            </div>
          </article>
        ))}
      </div>
      <div className="card flex flex-wrap items-center gap-2 px-3.5 py-2.5 text-[12.5px]">
        <span className="font-semibold">New series</span>
        <input className="input !w-48 !py-1" placeholder="Name" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} />
        <input className="input !w-80 !py-1" placeholder="Premise" value={n.premise} onChange={(e) => setN({ ...n, premise: e.target.value })} />
        <button className="btn-primary !py-1" disabled={!n.name.trim()} onClick={async () => { await entry("POST", "series", { data: { ...n, format: "Shorts", episodes: [], categories: [] } }); setN({ name: "", premise: "" }); }}>Add</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Proposals({ d, projects, draft, entry, reload }: { d: Data; projects: { id: string; title: string }[]; draft: { sponsorId?: string; seriesId?: string; projectId?: string }; entry: Entry; reload: () => void }) {
  const [sponsorId, setSponsor] = useState(draft.sponsorId ?? "");
  const [seriesId, setSeries] = useState(draft.seriesId ?? "");
  const [projectId, setProject] = useState(draft.projectId ?? "");
  const [rows, setRows] = useState(d.rates.lines.filter((l) => !/Add-on/.test(l.deliverable)).map((l, i) => ({ ...l, on: i === 0, count: 1 })));
  const [addOns, setAddOns] = useState<string[]>([]);
  const [timeline, setTimeline] = useState("");
  const [notes, setNotes] = useState("");
  const [preview, setPreview] = useState<{ title: string; body: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const input = () => ({
    sponsorId: sponsorId || null, seriesId: seriesId || null, projectId: projectId || null,
    deliverables: rows.filter((r) => r.on).map((r) => ({ label: r.deliverable, count: r.count, low: r.low, high: r.high })), addOns, timeline, notes,
  });
  const addOnLines = d.rates.lines.filter((l) => /Add-on/.test(l.deliverable));
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="card space-y-2 px-4 py-4 text-[12.5px]">
        <h2 className="font-serif text-[18px] font-semibold">Build a proposal</h2>
        <p className="text-muted">Fills in your real numbers, best posts, how the brand appears without hurting the video, deliverables, prices, reporting and terms. Edit anything after.</p>
        <select className="input text-[12.5px]" value={sponsorId} onChange={(e) => setSponsor(e.target.value)}><option value="">Brand (optional)</option>{d.sponsors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select className="input text-[12.5px]" value={seriesId} onChange={(e) => setSeries(e.target.value)}><option value="">Series (optional)</option>{d.series.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select className="input text-[12.5px]" value={projectId} onChange={(e) => setProject(e.target.value)}><option value="">…or a single project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
        <h3 className="pt-1 font-semibold">Deliverables</h3>
        {rows.map((r, i) => (
          <label key={r.deliverable} className="flex items-center gap-2">
            <input type="checkbox" checked={r.on} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} />
            <span className="flex-1">{r.deliverable}</span>
            <input type="number" min={1} className="input !w-14 !py-0" value={r.count} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, count: Math.max(1, Number(e.target.value)) } : x)))} />
            <input type="number" className="input !w-24 !py-0" value={r.low} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, low: Number(e.target.value) } : x)))} />–
            <input type="number" className="input !w-24 !py-0" value={r.high} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, high: Number(e.target.value) } : x)))} />
          </label>
        ))}
        <h3 className="pt-1 font-semibold">Optional add-ons offered</h3>
        {addOnLines.map((a) => {
          const label = `${a.deliverable.replace("Add-on: ", "")} (${bdt(a.low)}–${bdt(a.high)})`;
          return <label key={a.deliverable} className="flex items-center gap-2"><input type="checkbox" checked={addOns.includes(label)} onChange={(e) => setAddOns(e.target.checked ? [...addOns, label] : addOns.filter((x) => x !== label))} />{label}</label>;
        })}
        <input className="input text-[12.5px]" placeholder="Timeline (optional)" value={timeline} onChange={(e) => setTimeline(e.target.value)} />
        <textarea className="input min-h-[60px] text-[12.5px]" placeholder="Anything else to include" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex gap-2">
          <button className="btn !py-1" onClick={async () => setPreview((await api<{ preview: { title: string; body: string } }>("/api/monetise/proposals", "POST", { ...input(), preview: true })).preview)}>Preview</button>
          <button className="btn-primary !py-1" onClick={async () => { await api("/api/monetise/proposals", "POST", input()); setPreview(null); reload(); }}>Save proposal</button>
        </div>
        {preview && <pre className="max-h-[420px] overflow-y-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-[12px] leading-relaxed">{preview.body}</pre>}
      </section>
      <section className="space-y-2">
        <h2 className="font-serif text-[18px] font-semibold">Your proposals ({d.proposals.length})</h2>
        {d.proposals.map((p) => (
          <article key={p.id} className="card px-3.5 py-2.5 text-[12.5px]">
            <div className="flex flex-wrap items-center gap-2">
              <b className="flex-1 text-ink">{p.title}</b>
              {p.priceLow != null && <span className="text-muted">{bdt(p.priceLow)}–{bdt(p.priceHigh ?? p.priceLow)}</span>}
              <select className="input !w-auto !py-0 text-[12px]" value={p.status} onChange={(e) => entry("PATCH", "proposal", { id: p.id, data: { status: e.target.value } })}>{["draft", "sent", "accepted", "declined"].map((x) => <option key={x}>{x}</option>)}</select>
            </div>
            <div className="mt-1 flex gap-3 text-[11.5px]">
              <button className="text-accent hover:underline" onClick={() => setOpen(open === p.id ? null : p.id)}>{open === p.id ? "Close" : "Open & edit"}</button>
              <button className="text-accent hover:underline" onClick={() => navigator.clipboard.writeText(p.body)}>Copy</button>
              <a className="text-accent hover:underline" download={`${p.title.replace(/[^\w]+/g, "-").slice(0, 60)}.md`} href={`data:text/markdown;charset=utf-8,${encodeURIComponent(p.body)}`}>Download</a>
              <button className="ml-auto text-muted hover:text-bad" onClick={() => confirm("Delete this proposal?") && entry("DELETE", "proposal", { id: p.id })}>Delete</button>
            </div>
            {open === p.id && <textarea className="input mt-2 min-h-[360px] font-mono text-[12px]" defaultValue={p.body} onBlur={(e) => e.target.value !== p.body && entry("PATCH", "proposal", { id: p.id, data: { body: e.target.value } })} />}
          </article>
        ))}
        {!d.proposals.length && <p className="text-[12.5px] text-muted">None yet.</p>}
      </section>
    </div>
  );
}
