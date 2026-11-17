"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { AiButton } from "../AiButton";
import { Icon } from "../Icon";
import type { ExpertItem, ExpertKind, ExpertNote, Glance, GlancePoint, Scope, SolutionsBrief } from "@/lib/experts";

const KINDS: { id: ExpertKind; label: string; tone: string }[] = [
  { id: "research", label: "Research", tone: "bg-ai-soft text-ai" },
  { id: "policy", label: "Policy & think tanks", tone: "bg-accent-soft text-accent" },
  { id: "opinion", label: "Opinion & analysis", tone: "bg-warn-soft text-warn" },
  { id: "official", label: "Official & legal", tone: "bg-ok-soft text-ok" },
  { id: "video", label: "Videos & podcasts", tone: "bg-surface-2 text-ink-2" },
  { id: "background", label: "Background & history", tone: "bg-surface-2 text-ink-2" },
  { id: "statement", label: "Statements", tone: "bg-surface-2 text-ink-2" },
];
/** Links from outside sources: only http(s), never javascript: or data:. */
const safeHref = (u: string) => (/^https?:\/\//i.test(u) ? u : "#");
const KIND_OF = Object.fromEntries(KINDS.map((k) => [k.id, k])) as Record<ExpertKind, (typeof KINDS)[number]>;
const TAGS = [
  { id: "solutions", label: "Solutions" },
  { id: "other countries", label: "Other countries" },
  { id: "history", label: "History & precedent" },
  { id: "legal", label: "Laws & treaties" },
  { id: "Bangladesh", label: "Bangladesh" },
];

interface Data { items: ExpertItem[]; run: { query: string; fetchedAt: string } | null; brief: SolutionsBrief | null; terms: string[]; glance: Glance | null }

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
  const [tab, setTab] = useState<"glance" | "library" | "brief">("glance");
  const [focus, setFocus] = useState<string | null>(null);
  // Jump from the summary to an item (or a filtered view) in the library.
  const showInLibrary = (o: { id?: string; kind?: ExpertKind; tag?: string; q?: string }) => {
    setKind(o.kind ?? "all");
    setTags(o.tag ? [o.tag] : []);
    setQ(o.q ?? "");
    setSavedOnly(false);
    setShowAll(!!o.id);
    setFocus(o.id ?? null);
    setTab("library");
  };
  useEffect(() => {
    if (tab === "library" && focus) setTimeout(() => document.getElementById(`ex-${focus}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  }, [tab, focus]);
  const setNote = (id: string, note: ExpertNote) => setData((d) => d && { ...d, items: d.items.map((x) => (x.id === id ? { ...x, aiNote: note } : x)) });

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
            <button className={`-mb-px border-b-2 px-2 py-1 ${tab === "glance" ? "border-accent font-semibold text-ink" : "border-transparent text-muted"}`} onClick={() => setTab("glance")}>At a glance</button>
            <button className={`-mb-px border-b-2 px-2 py-1 ${tab === "library" ? "border-accent font-semibold text-ink" : "border-transparent text-muted"}`} onClick={() => setTab("library")}>Library ({items.length})</button>
            <button className={`-mb-px border-b-2 px-2 py-1 ${tab === "brief" ? "border-accent font-semibold text-ink" : "border-transparent text-muted"}`} onClick={() => setTab("brief")}>Solutions brief {data.brief ? "✓" : "(AI)"}</button>
          </div>

          {tab === "glance" && data.glance && <GlanceView g={data.glance} items={items} onShow={showInLibrary} onNote={setNote} compact={compact} />}

          {data.terms.length > 0 && tab !== "glance" && (
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
                      {term.t.url && <a href={safeHref(term.t.url)} target="_blank" rel="noreferrer" className="ml-1 text-accent hover:underline">Wikipedia</a>}
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
                  <li key={i.id} id={`ex-${i.id}`} className={`flex gap-2 py-2 ${focus === i.id ? "-mx-2 rounded-lg bg-accent-soft/40 px-2" : ""}`}>
                    <button title={scope === "project" ? "Keep — the script can cite it" : "Keep"} className={`mt-0.5 shrink-0 text-[15px] leading-none ${i.saved ? "text-accent" : "text-muted hover:text-ink"}`} onClick={() => toggleSave(i)}>{i.saved ? "★" : "☆"}</button>
                    <div className="min-w-0 flex-1">
                      <a href={safeHref(i.url)} target="_blank" rel="noreferrer" className="text-[13px] font-medium leading-snug text-ink hover:underline">{i.title} <Icon name="external" size={11} className="inline text-muted" /></a>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-muted">
                        <span className={`rounded-full px-1.5 py-px font-medium ${KIND_OF[i.kind].tone}`}>{KIND_OF[i.kind].label}</span>
                        {[i.publisher, i.year, i.authors && i.authors.split(",").slice(0, 2).join(",")].filter(Boolean).join(" · ")}
                        {i.tags.filter((t) => t !== "Bangladesh").map((t) => <span key={t} className="rounded-full border border-ok/30 px-1.5 text-ok">{t}</span>)}
                      </div>
                      {i.snippet && <p className={`mt-0.5 text-[12.5px] leading-relaxed text-ink-2 ${focus === i.id ? "" : compact ? "line-clamp-2" : "line-clamp-3"}`}>{i.snippet}</p>}
                      <AskAi item={i} onNote={setNote} />
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
      <a key={k} href={safeHref(r!.url)} target="_blank" rel="noreferrer" title={r!.title} className="mr-1 text-[11px] text-accent hover:underline">{r!.publisher || r!.label}</a>
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

const QUICK_ASKS = [
  ["Quick summary", "Summarise this in plain words: what does it argue or find?"],
  ["The evidence", "What evidence does this rest on, and how strong is it?"],
  ["For Bangladesh", "How does this apply to Bangladesh specifically?"],
  ["Counter-arguments", "What would critics say against this, and what are its weak spots?"],
] as const;

/** Optional, per item: the AI reads the page (or abstract) and answers. The answer is kept, so it's paid once. */
function AskAi({ item, onNote }: { item: ExpertItem; onNote: (id: string, n: ExpertNote) => void }) {
  const [open, setOpen] = useState(false);
  const n = item.aiNote;
  return (
    <div className="mt-1">
      <div className="flex flex-wrap items-center gap-3 text-[11.5px]">
        <a href={safeHref(item.url)} target="_blank" rel="noreferrer" className="text-ink-2 hover:text-accent">Read it myself ↗</a>
        <button className="font-medium text-ai hover:underline" onClick={() => setOpen((o) => !o)}>{n ? (open ? "Hide AI notes" : "AI notes ✓") : open ? "Close" : "Ask AI to look into it"}</button>
      </div>
      {open && <AskAiBox item={item} onNote={onNote} />}
    </div>
  );
}

function AskAiBox({ item, onNote }: { item: ExpertItem; onNote: (id: string, n: ExpertNote) => void }) {
  const [question, setQuestion] = useState("");
  const n = item.aiNote;
  return (
    <div>
      {(
        <div className="mt-1.5 rounded-lg border border-ai/20 bg-ai-soft/30 px-3 py-2 text-[12.5px]">
          {n && (
            <div className="mb-2 space-y-1 text-ink-2">
              <div className="text-[11px] text-muted">Q: {n.question} · read {n.read === "full" ? "the full page" : "the abstract only"}</div>
              <p>{n.answer}</p>
              {n.key_points.length > 0 && <ul className="list-disc pl-4">{n.key_points.map((k, j) => <li key={j}>{k}</li>)}</ul>}
              <p><span className="font-medium text-ink">Evidence: </span>{n.evidence}</p>
              <p><span className="font-medium text-ink">Bangladesh: </span>{n.bangladesh}</p>
              {n.caveats.length > 0 && <p className="text-[12px] text-muted">Careful: {n.caveats.join(" · ")}</p>}
            </div>
          )}
          <div className="flex flex-wrap gap-1">
            {QUICK_ASKS.map(([label, q]) => <button key={label} className={question === q ? "chip-accent" : "chip"} onClick={() => setQuestion(q)}>{label}</button>)}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <input className="input flex-1 !py-1 text-[12.5px]" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Or ask your own question about it… (default: what it says, the evidence, and Bangladesh)" />
            <AiButton label={n ? "Ask again" : "Ask AI"} endpoint="/api/experts/ask" payload={{ id: item.id, question: question || undefined }} size="sm" runningLabel="Reading…" onResult={(r) => onNote(item.id, r.data as ExpertNote)} />
          </div>
        </div>
      )}
    </div>
  );
}

/** The whole library at a glance — pulled straight from the sources, no AI. */
function GlanceView({ g, items, onShow, onNote, compact }: { g: Glance; items: ExpertItem[]; onShow: (o: { id?: string; kind?: ExpertKind; tag?: string; q?: string }) => void; onNote: (id: string, n: ExpertNote) => void; compact: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const byId = new Map(items.map((i) => [i.id, i]));
  return (
    <div className="mt-3 space-y-3">
      <div className="rounded-lg bg-surface-2/70 px-3 py-2 text-[12.5px] text-ink-2">
        <span className="font-semibold text-ink">{g.total} sources</span>
        {g.years && <span> spanning {g.years.min === g.years.max ? g.years.min : `${g.years.min}–${g.years.max}`}</span>}:{" "}
        {g.kinds.map((k, j) => (
          <span key={k.kind}>{j > 0 && " · "}<button className="hover:text-accent hover:underline" onClick={() => onShow({ kind: k.kind })}>{k.count} {KIND_OF[k.kind].label.toLowerCase()}</button></span>
        ))}
        {g.voices.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <span className="text-muted">Who&apos;s weighing in:</span>
            {g.voices.slice(0, compact ? 5 : 10).map((v) => <button key={v.name} className="chip !text-[11.5px]" onClick={() => onShow({ q: v.name })}>{v.name}{v.count > 1 ? ` ${v.count}` : ""}</button>)}
          </div>
        )}
      </div>

      <div className={`grid gap-3 ${compact ? "" : "md:grid-cols-2"}`}>
        {g.themes.map((t) => (
          <div key={t.id} className="rounded-xl border border-line px-3 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-[13.5px] font-semibold text-ink">{t.label}</h3>
              <button className="shrink-0 text-[11.5px] text-accent hover:underline" onClick={() => onShow({ tag: t.id })}>All {t.count} →</button>
            </div>
            <div className="text-[11px] text-muted">{t.hint}</div>
            <ul className="divide-y divide-line">{t.points.slice(0, compact ? 2 : 4).map((p) => <GlancePointRow key={p.itemId} p={p} item={byId.get(p.itemId)} open={open === p.itemId} onToggle={() => setOpen(open === p.itemId ? null : p.itemId)} onShow={onShow} onNote={onNote} />)}</ul>
          </div>
        ))}
      </div>

      {g.readFirst.length > 0 && (
        <div>
          <div className="eyebrow mb-1">If you only read a few — the strongest of each kind</div>
          <ul className="space-y-1 text-[12.5px]">
            {g.readFirst.map((p) => (
              <li key={p.itemId} className="flex flex-wrap items-baseline gap-x-2">
                <span className={`rounded-full px-1.5 py-px text-[10.5px] font-medium ${KIND_OF[p.kind].tone}`}>{KIND_OF[p.kind].label}</span>
                <a href={safeHref(p.url)} target="_blank" rel="noreferrer" className="font-medium text-ink hover:underline">{p.title}</a>
                <button className="text-[11.5px] text-accent hover:underline" onClick={() => onShow({ id: p.itemId })}>In library</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-[11px] text-muted">Pulled word-for-word from the sources themselves — no AI, free. Want more? “Ask AI” on any point reads that source for you, or the Solutions brief tab organises everything into options with pros and cons.</p>
    </div>
  );
}


function GlancePointRow({ p, item, open, onToggle, onShow, onNote }: { p: GlancePoint; item?: ExpertItem; open: boolean; onToggle: () => void; onShow: (o: { id?: string }) => void; onNote: (id: string, n: ExpertNote) => void }) {
  return (
    <li className="py-1.5">
      {p.text && <p className="text-[12.5px] leading-relaxed text-ink-2">{p.text}</p>}
      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px]">
        <span className="text-muted">— {[p.publisher, p.year].filter(Boolean).join(", ") || KIND_OF[p.kind].label}</span>
        <a href={safeHref(p.url)} target="_blank" rel="noreferrer" className="text-ink-2 hover:text-accent">Read ↗</a>
        <button className="text-accent hover:underline" onClick={() => onShow({ id: p.itemId })}>In library</button>
        {item && <button className="font-medium text-ai hover:underline" onClick={onToggle}>{item.aiNote ? "AI notes ✓" : "Ask AI"}</button>}
      </div>
      {item && open && <AskAiBox item={item} onNote={onNote} />}
    </li>
  );
}
