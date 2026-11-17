"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { AiButton } from "../AiButton";
import { Icon } from "../Icon";
import type { ExpertItem, ExpertKind, Scope, SolutionsBrief } from "@/lib/experts";

const KINDS: { id: ExpertKind; label: string; tone: string }[] = [
  { id: "research", label: "Research", tone: "bg-ai-soft text-ai" },
  { id: "policy", label: "Policy & think tanks", tone: "bg-accent-soft text-accent" },
  { id: "opinion", label: "Opinion & analysis", tone: "bg-warn-soft text-warn" },
  { id: "official", label: "Official & legal", tone: "bg-ok-soft text-ok" },
  { id: "video", label: "Videos & podcasts", tone: "bg-surface-2 text-ink-2" },
  { id: "background", label: "Background & history", tone: "bg-surface-2 text-ink-2" },
  { id: "statement", label: "Statements", tone: "bg-surface-2 text-ink-2" },
];
const KIND_OF = Object.fromEntries(KINDS.map((k) => [k.id, k])) as Record<ExpertKind, (typeof KINDS)[number]>;
const TAGS = [
  { id: "solutions", label: "Solutions" },
  { id: "other countries", label: "Other countries" },
  { id: "history", label: "History & precedent" },
  { id: "legal", label: "Laws & treaties" },
  { id: "Bangladesh", label: "Bangladesh" },
];

interface Data { items: ExpertItem[]; run: { query: string; fetchedAt: string } | null; brief: SolutionsBrief | null; terms: string[] }

/**
 * Expert views: research papers, policy briefs, op-eds, official texts, expert videos and history —
 * gathered free from open sources, filterable, with an optional AI solutions brief (pros and cons).
 */
export function ExpertPanel({ scope, refId, title = "Solutions & expert views", compact = false, autoGather = false }: { scope: Scope; refId: string; title?: string; compact?: boolean; autoGather?: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [kind, setKind] = useState<"all" | ExpertKind>("all");
  const [tags, setTags] = useState<string[]>([]);
  const [savedOnly, setSavedOnly] = useState(false);
  const [q, setQ] = useState("");
  const [term, setTerm] = useState<{ q: string; t: { title: string; extract: string; url: string } | null; loading: boolean } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [tab, setTab] = useState<"library" | "brief">("library");

  const load = () => api<Data>(`/api/experts?scope=${scope}&ref=${encodeURIComponent(refId)}`).then(setData).catch((e) => setErr((e as Error).message));
  useEffect(() => {
    setData(null);
    load().then(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, refId]);

  const gather = async (force: boolean) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ added: number; errors: string[] }>("/api/experts", "POST", { scope, ref: refId, force });
      await load();
      if (r.errors.length) setErr(`Some sources didn't answer: ${r.errors.join(" · ")}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  // A searched topic gathers straight away (free).
  useEffect(() => {
    if (autoGather && data && !data.run && !busy) gather(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGather, data?.run, data === null]);

  const toggleSave = async (it: ExpertItem) => {
    setData((d) => d && { ...d, items: d.items.map((x) => (x.id === it.id ? { ...x, saved: !x.saved } : x)) });
    await api("/api/experts", "PATCH", { id: it.id, saved: !it.saved }).catch(() => load());
  };
  const define = async (t: string) => {
    if (term?.q === t) return setTerm(null);
    setTerm({ q: t, t: null, loading: true });
    const r = await api<{ term: { title: string; extract: string; url: string } | null }>(`/api/experts/term?q=${encodeURIComponent(t)}`).catch(() => ({ term: null }));
    setTerm({ q: t, t: r.term, loading: false });
  };

  const items = data?.items ?? [];
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of items) c[i.kind] = (c[i.kind] ?? 0) + 1;
    for (const i of items) for (const t of i.tags) c[`#${t}`] = (c[`#${t}`] ?? 0) + 1;
    return c;
  }, [items]);
  const list = items.filter((i) => {
    if (kind !== "all" && i.kind !== kind) return false;
    if (savedOnly && !i.saved) return false;
    if (tags.length && !tags.every((t) => i.tags.includes(t))) return false;
    if (q.trim()) {
      const hay = `${i.title} ${i.snippet ?? ""} ${i.publisher ?? ""} ${i.authors ?? ""}`.toLowerCase();
      if (!q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w))) return false;
    }
    return true;
  });
  const limit = compact ? 6 : 14;
  const shown = showAll ? list : list.slice(0, limit);
  const savedCount = items.filter((i) => i.saved).length;

  return (
    <section className="card px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-serif text-[17px] font-semibold">{title}</h2>
        <span className="text-[11.5px] text-muted">Papers, policy briefs, op-eds, laws & treaties, expert videos and history — free</span>
        <span className="ml-auto flex items-center gap-2">
          {data?.run && <button className="text-[12px] text-accent hover:underline disabled:opacity-50" disabled={busy} onClick={() => gather(true)}>{busy ? "Refreshing…" : "Refresh"}</button>}
        </span>
      </div>

      {data === null && !err && <p className="mt-2 text-[12.5px] text-muted">Loading…</p>}
      {data && !data.run && (
        <div className="mt-2 rounded-lg bg-surface-2 px-3 py-2.5 text-[12.5px] text-ink-2">
          Find what experts, researchers, governments and other countries have said and done about this — and the solutions on the table.
          <div className="mt-2"><button className="btn-primary !py-1 !text-[12.5px]" disabled={busy} onClick={() => gather(false)}>{busy ? "Searching open sources… (~20s)" : "Gather expert views (free)"}</button></div>
        </div>
      )}
      {err && <p className="mt-2 text-[12px] text-warn">{err}</p>}

      {data?.run && (
        <>
          <div className="mt-2 flex gap-1 border-b border-line text-[12.5px]">
            <button className={`-mb-px border-b-2 px-2 py-1 ${tab === "library" ? "border-accent font-semibold text-ink" : "border-transparent text-muted"}`} onClick={() => setTab("library")}>Library ({items.length})</button>
            <button className={`-mb-px border-b-2 px-2 py-1 ${tab === "brief" ? "border-accent font-semibold text-ink" : "border-transparent text-muted"}`} onClick={() => setTab("brief")}>Solutions brief {data.brief ? "✓" : "(AI)"}</button>
          </div>

          {data.terms.length > 0 && (
            <div className="mt-2">
              <div className="flex flex-wrap items-center gap-1 text-[12px]">
                <span className="text-muted">Key terms:</span>
                {data.terms.map((t) => <button key={t} className={term?.q === t ? "chip-accent" : "chip"} onClick={() => define(t)}>{t}</button>)}
              </div>
              {term && (
                <div className="mt-1.5 rounded-lg bg-surface-2 px-3 py-2 text-[12.5px] leading-relaxed text-ink-2">
                  {term.loading ? "Looking it up…" : term.t ? (
                    <>
                      <span className="font-semibold text-ink">{term.t.title}: </span>{term.t.extract}
                      {term.t.url && <a href={term.t.url} target="_blank" rel="noreferrer" className="ml-1 text-accent hover:underline">Wikipedia</a>}
                    </>
                  ) : "No plain definition found."}
                </div>
              )}
            </div>
          )}

          {tab === "library" && (
            <>
              <div className="mt-2 flex flex-wrap gap-1">
                <button className={kind === "all" ? "chip-accent" : "chip"} onClick={() => setKind("all")}>All {items.length}</button>
                {KINDS.filter((k) => counts[k.id]).map((k) => <button key={k.id} className={kind === k.id ? "chip-accent" : "chip"} onClick={() => setKind(k.id)}>{k.label} {counts[k.id]}</button>)}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                {TAGS.filter((t) => counts[`#${t.id}`]).map((t) => (
                  <button key={t.id} className={`rounded-full border px-2 py-0.5 text-[11.5px] ${tags.includes(t.id) ? "border-ok bg-ok-soft text-ok" : "border-line text-ink-2"}`} onClick={() => setTags((x) => (x.includes(t.id) ? x.filter((y) => y !== t.id) : [...x, t.id]))}>
                    {t.label} {counts[`#${t.id}`]}
                  </button>
                ))}
                <button className={`rounded-full border px-2 py-0.5 text-[11.5px] ${savedOnly ? "border-accent bg-accent-soft text-accent" : "border-line text-ink-2"}`} onClick={() => setSavedOnly((s) => !s)}>★ Kept {savedCount}</button>
                <input className="input ml-auto !py-1 text-[12.5px] sm:w-52" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search within…" />
              </div>
              <ul className="mt-2 divide-y divide-line">
                {shown.map((i) => (
                  <li key={i.id} className="flex gap-2 py-2">
                    <button title={scope === "project" ? "Keep — the script can cite it" : "Keep"} className={`mt-0.5 shrink-0 text-[15px] leading-none ${i.saved ? "text-accent" : "text-muted hover:text-ink"}`} onClick={() => toggleSave(i)}>{i.saved ? "★" : "☆"}</button>
                    <div className="min-w-0 flex-1">
                      <a href={i.url} target="_blank" rel="noreferrer" className="text-[13px] font-medium leading-snug text-ink hover:underline">{i.title} <Icon name="external" size={11} className="inline text-muted" /></a>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-muted">
                        <span className={`rounded-full px-1.5 py-px font-medium ${KIND_OF[i.kind].tone}`}>{KIND_OF[i.kind].label}</span>
                        {[i.publisher, i.year, i.authors && i.authors.split(",").slice(0, 2).join(",")].filter(Boolean).join(" · ")}
                        {i.tags.filter((t) => t !== "Bangladesh").map((t) => <span key={t} className="rounded-full border border-ok/30 px-1.5 text-ok">{t}</span>)}
                      </div>
                      {i.snippet && <p className={`mt-0.5 text-[12.5px] leading-relaxed text-ink-2 ${compact ? "line-clamp-2" : "line-clamp-3"}`}>{i.snippet}</p>}
                    </div>
                  </li>
                ))}
              </ul>
              {!list.length && <p className="py-2 text-[12.5px] text-muted">Nothing matches these filters.</p>}
              {list.length > limit && <button className="text-[12.5px] text-accent hover:underline" onClick={() => setShowAll((s) => !s)}>{showAll ? "Show fewer" : `Show all ${list.length}`}</button>}
              <p className="mt-1 text-[11px] text-muted">Searched for “{data.run.query}”. Sources: OpenAlex, think-tank & op-ed search, Wikipedia, YouTube and your Desk. ★ Keep the ones you trust{scope === "project" ? " — kept items become sources your script can cite" : ""}.</p>
            </>
          )}

          {tab === "brief" && (
            <div className="mt-2 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <AiButton label={data.brief ? "Rewrite the brief" : "Write a solutions brief"} endpoint="/api/experts/brief" payload={{ scope, ref: refId }} confirm="always" size="sm"
                  onResult={(r) => setData((d) => d && { ...d, brief: r.data as SolutionsBrief })} />
                <span className="text-[11.5px] text-muted">Options with pros & cons, precedents elsewhere and the trade-offs — only from the library above. Saved once written.</span>
              </div>
              {data.brief ? <BriefView b={data.brief} /> : <p className="text-[12.5px] text-muted">Optional. The library is everything you need to browse; the brief organises it into solutions you can talk about.</p>}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function BriefView({ b }: { b: SolutionsBrief }) {
  const ref = (labels: string[]) =>
    labels.map((l) => b.refs.find((r) => r.label === l.replace(/[[\]"]/g, ""))).filter(Boolean).map((r, k) => (
      <a key={k} href={r!.url} target="_blank" rel="noreferrer" title={r!.title} className="mr-1 text-[11px] text-accent hover:underline">{r!.publisher || r!.label}</a>
    ));
  return (
    <div className="space-y-3 text-[13px] leading-relaxed text-ink-2">
      <div>
        <div className="eyebrow mb-0.5">The problem</div>
        <p>{b.problem}</p>
        {b.root_causes.length > 0 && <ul className="mt-1 list-disc pl-4 text-[12.5px]">{b.root_causes.map((c, i) => <li key={i}>{c}</li>)}</ul>}
      </div>
      <div>
        <div className="eyebrow mb-1">Options on the table</div>
        <div className="grid gap-2 md:grid-cols-2">
          {b.options.map((o, i) => (
            <div key={i} className="rounded-lg border border-line px-3 py-2">
              <div className="font-semibold text-ink">{o.option}</div>
              <div className="text-[11.5px] text-muted">Who acts: {o.who_acts}</div>
              <p className="mt-1 text-[12.5px]">{o.how_it_works}</p>
              {o.examples_elsewhere && <p className="mt-1 text-[12px]"><span className="font-medium text-ink">Elsewhere: </span>{o.examples_elsewhere}</p>}
              {o.evidence && <p className="mt-0.5 text-[12px]"><span className="font-medium text-ink">Evidence: </span>{o.evidence}</p>}
              <div className="mt-1.5 grid grid-cols-2 gap-2 text-[12px]">
                <div><div className="font-semibold text-ok">Pros</div><ul className="list-disc pl-4">{o.pros.map((p, k) => <li key={k}>{p}</li>)}</ul></div>
                <div><div className="font-semibold text-warn">Cons</div><ul className="list-disc pl-4">{o.cons.map((p, k) => <li key={k}>{p}</li>)}</ul></div>
              </div>
              <p className="mt-1 text-[12px]"><span className="font-medium text-ink">In Bangladesh: </span>{o.feasibility}</p>
              <div className="mt-0.5">{ref(o.sources)}</div>
            </div>
          ))}
        </div>
      </div>
      {b.precedents.length > 0 && (
        <div>
          <div className="eyebrow mb-1">Precedents — elsewhere and in history</div>
          <ul className="space-y-1">{b.precedents.map((p, i) => <li key={i}><span className="font-medium text-ink">{p.where}, {p.when}: </span>{p.what} → <span className="italic">{p.outcome}</span> {ref(p.sources)}</li>)}</ul>
        </div>
      )}
      <div><div className="eyebrow mb-0.5">What Bangladesh has tried</div><p>{b.bangladesh_so_far}</p></div>
      <div><div className="eyebrow mb-0.5">The hardest trade-off</div><p>{b.trade_offs}</p></div>
      {b.what_to_watch.length > 0 && <div><div className="eyebrow mb-0.5">What to watch</div><ul className="list-disc pl-4">{b.what_to_watch.map((w, i) => <li key={i}>{w}</li>)}</ul></div>}
      <p className="text-[11px] text-muted">AI organisation of the library · {new Date(b.at).toLocaleDateString()} · check each claim against its source before saying it on camera.</p>
    </div>
  );
}
