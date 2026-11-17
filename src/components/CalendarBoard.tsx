"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "./api";
import { Icon } from "./Icon";
import { PROD_STAGES, TYPE_BY_ID, type Production } from "@/lib/production-shared";

interface IdeaLite { id: string; title: string; format: string }

const FORMAT_TO_TYPE: Record<string, string> = {
  "short-video": "short", podcast: "podcast", interview: "interview", series: "series", carousel: "carousel",
  thread: "article", explainer: "article", "op-ed": "article", essay: "article", newsletter: "article",
};

function shiftMonth(month: string, d: number): string {
  const [y, m] = month.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + d, 1));
  return dt.toISOString().slice(0, 7);
}

function Bar({ pct }: { pct: number }) {
  return (
    <div className="h-1 overflow-hidden rounded-full bg-surface-2">
      <div className={`h-full rounded-full ${pct >= 100 ? "bg-ok" : "bg-gradient-to-r from-accent to-accent-2"}`} style={{ width: `${Math.max(4, pct)}%` }} />
    </div>
  );
}

function Chip({ p }: { p: Production }) {
  const t = TYPE_BY_ID[p.contentType];
  return (
    <Link href={`/research/${p.projectId}`} className="block rounded-md border border-line bg-surface px-1.5 py-1 text-[11.5px] leading-tight hover:border-line-strong" title={`${t?.label ?? p.contentType} · ${PROD_STAGES.find((s) => s.id === p.stage)?.label} · ${p.progress}%`}>
      <span className="flex items-center gap-1">
        <span className={`inline-block h-2 w-2 shrink-0 rounded-full ch-dot-${t?.color ?? "coral"}`} />
        <span className="line-clamp-2 text-ink">{p.title}</span>
      </span>
      <div className="mt-1"><Bar pct={p.progress} /></div>
    </Link>
  );
}

/** Month view + unscheduled pieces + saved ideas to schedule + a by-stage board. */
export function CalendarBoard({ month, items, ideas, today }: { month: string; items: Production[]; ideas: IdeaLite[]; today: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [dates, setDates] = useState<Record<string, string>>({});

  const cells = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const offset = (first.getUTCDay() + 6) % 7; // Monday first
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const out: (string | null)[] = Array.from({ length: offset }, () => null);
    for (let d = 1; d <= days; d++) out.push(`${month}-${String(d).padStart(2, "0")}`);
    while (out.length % 7) out.push(null);
    return out;
  }, [month]);

  const byDate = useMemo(() => {
    const m = new Map<string, Production[]>();
    for (const p of items) if (p.publishDate) (m.get(p.publishDate) ?? m.set(p.publishDate, []).get(p.publishDate)!).push(p);
    return m;
  }, [items]);
  const unscheduled = items.filter((p) => !p.publishDate && p.stage !== "live");
  const label = new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const thisMonth = items.filter((p) => p.publishDate?.startsWith(month));
  const avg = thisMonth.length ? Math.round(thisMonth.reduce((s, p) => s + p.progress, 0) / thisMonth.length) : 0;

  const schedule = async (projectId: string, date: string) => {
    await api(`/api/projects/${projectId}/production`, "PATCH", { publishDate: date });
    router.refresh();
  };
  const scheduleIdea = async (idea: IdeaLite) => {
    const date = dates[idea.id];
    if (!date) return;
    setBusy(idea.id);
    const r = await api<{ projectId: string }>(`/api/ideas/${idea.id}/develop`, "POST", {});
    await api(`/api/projects/${r.projectId}/production`, "PATCH", { publishDate: date, contentType: FORMAT_TO_TYPE[idea.format] ?? "video" });
    setBusy(null);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-[30px] font-bold tracking-tight">Content calendar</h1>
          <p className="text-[13px] text-muted">{thisMonth.length} pieces planned in {label}{thisMonth.length ? ` · ${avg}% done on average` : ""}</p>
        </div>
        <div className="flex items-center gap-1">
          <Link className="btn !px-2" href={`/calendar?m=${shiftMonth(month, -1)}`}><Icon name="arrowLeft" size={14} /></Link>
          <Link className="btn" href="/calendar">Today</Link>
          <Link className="btn !px-2" href={`/calendar?m=${shiftMonth(month, 1)}`}><Icon name="right" size={14} /></Link>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="card overflow-hidden">
          <div className="border-b border-line px-4 py-2 font-serif text-[18px] font-semibold">{label}</div>
          <div className="grid grid-cols-7 border-b border-line bg-surface-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-1.5">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((d, i) => (
              <div key={i} className={`min-h-[96px] border-b border-r border-line p-1 ${d ? "" : "bg-surface-2/40"} ${d === today ? "bg-accent-soft/60" : ""}`}>
                {d && (
                  <>
                    <div className={`mb-1 text-right text-[11px] tabular-nums ${d === today ? "font-bold text-accent" : "text-muted"}`}>{Number(d.slice(8))}</div>
                    <div className="space-y-1">{(byDate.get(d) ?? []).map((p) => <Chip key={p.projectId} p={p} />)}</div>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="card p-4">
            <h3 className="font-serif text-[16px] font-semibold">Not scheduled yet</h3>
            <p className="mb-2 text-[11.5px] text-muted">Pieces in progress without a date.</p>
            <ul className="space-y-2.5">
              {unscheduled.slice(0, 12).map((p) => (
                <li key={p.projectId}>
                  <Link href={`/research/${p.projectId}`} className="text-[13px] font-medium leading-snug text-ink hover:underline">{p.title}</Link>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1"><Bar pct={p.progress} /></div>
                    <input type="date" className="input !w-auto !py-0 text-[11.5px]" onChange={(e) => e.target.value && schedule(p.projectId, e.target.value)} />
                  </div>
                </li>
              ))}
              {!unscheduled.length && <li className="text-[12.5px] text-muted">Everything in progress has a date.</li>}
            </ul>
          </section>
          <section className="card p-4">
            <h3 className="font-serif text-[16px] font-semibold">Saved ideas to schedule</h3>
            <p className="mb-2 text-[11.5px] text-muted">Pick a date — it becomes a project on the calendar.</p>
            <ul className="space-y-2.5">
              {ideas.slice(0, 12).map((i) => (
                <li key={i.id}>
                  <Link href={`/ideas/${i.id}`} className="text-[13px] leading-snug text-ink hover:underline">{i.title}</Link>
                  <div className="mt-1 flex items-center gap-1.5">
                    <input type="date" className="input !w-auto !py-0 text-[11.5px]" value={dates[i.id] ?? ""} onChange={(e) => setDates({ ...dates, [i.id]: e.target.value })} />
                    <button className="btn !py-0.5 !text-[12px]" disabled={!dates[i.id] || busy === i.id} onClick={() => scheduleIdea(i)}>{busy === i.id ? "…" : "Schedule"}</button>
                  </div>
                </li>
              ))}
              {!ideas.length && <li className="text-[12.5px] text-muted">Save ideas in the Studio and they&apos;ll wait here.</li>}
            </ul>
          </section>
        </aside>
      </div>

      <section>
        <h2 className="mb-2 font-serif text-[20px] font-semibold">Production board</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
          {PROD_STAGES.map((s) => {
            const col = items.filter((p) => p.stage === s.id);
            return (
              <div key={s.id} className="card p-3">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">{s.label}</span>
                  <span className="text-[12px] tabular-nums text-muted">{col.length}</span>
                </div>
                <div className="space-y-1.5">{col.slice(0, 8).map((p) => <Chip key={p.projectId} p={p} />)}</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
