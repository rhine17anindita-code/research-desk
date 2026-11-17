import Link from "next/link";
import { getDb } from "@/lib/db";
import { keptExperts, KIND_LABEL, recentLibraries } from "@/lib/experts";
import { ExpertPanel } from "@/components/research/ExpertPanel";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

const STARTERS = [
  "Rohingya repatriation", "Teesta water sharing", "garment workers safety ILO", "climate migration Bangladesh", "bank loan defaults reform",
  "election commission independence", "youth unemployment Bangladesh", "air pollution Dhaka", "remittance hundi", "digital security act press freedom",
];

/** A browsable library of expert views — search any topic, or reopen one gathered for a story or project. */
export default async function ExpertsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const tab = sp.tab ?? "search";
  const db = getDb();
  const libs = recentLibraries(db);
  const kept = tab === "kept" ? keptExperts(db) : [];
  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-4">
        <h1 className="font-serif text-[28px] font-semibold tracking-tight">Expert views</h1>
        <p className="text-[13px] text-muted">Research papers, policy briefs, think tanks, op-eds, laws and treaties, expert videos and history — what experts say, what other countries did, and the solutions on the table. Gathering is free; the solutions brief is optional AI.</p>
      </header>
      <div className="mb-4 flex gap-1 border-b border-line text-[13px]">
        {[["search", "Search a topic"], ["libraries", `Libraries (${libs.length})`], ["kept", "Kept"]].map(([id, label]) => (
          <Link key={id} href={`/experts?tab=${id}`} className={`-mb-px border-b-2 px-3 py-1.5 ${tab === id ? "border-accent font-semibold text-ink" : "border-transparent text-muted hover:text-ink"}`}>{label}</Link>
        ))}
      </div>

      {tab === "search" && (
        <div className="space-y-4">
          <form className="flex gap-2" action="/experts">
            <input name="q" defaultValue={q} className="input flex-1" placeholder="Any problem or policy: e.g. Teesta water sharing, minimum wage garment, ILO convention 190" />
            <button className="btn-primary">Find expert views</button>
          </form>
          {!q && (
            <div className="flex flex-wrap gap-1 text-[12.5px]">
              <span className="text-muted">Try:</span>
              {STARTERS.map((s) => <Link key={s} href={`/experts?q=${encodeURIComponent(s)}`} className="chip hover:border-accent hover:text-accent">{s}</Link>)}
            </div>
          )}
          {q && <ExpertPanel scope="topic" refId={q} title={`Expert views: ${q}`} autoGather />}
        </div>
      )}

      {tab === "libraries" && (
        <ul className="grid gap-2 md:grid-cols-2">
          {libs.map((l) => (
            <li key={`${l.scope}:${l.refId}`}>
              <Link href={l.href} className="card block px-3.5 py-2.5 hover:border-accent/40">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{l.scope === "cluster" ? "Story" : l.scope === "project" ? "Project" : "Topic"}</div>
                <div className="line-clamp-2 text-[13.5px] font-medium text-ink">{l.label}</div>
                <div className="mt-0.5 text-[11.5px] text-muted">{l.count} items · {l.kept} kept · {timeAgo(l.fetchedAt)}</div>
              </Link>
            </li>
          ))}
          {!libs.length && <p className="text-[12.5px] text-muted">None yet — search a topic, or open a story and press “Gather expert views”.</p>}
        </ul>
      )}

      {tab === "kept" && (
        <ul className="card divide-y divide-line px-4">
          {kept.map((i) => (
            <li key={i.id} className="py-2">
              <a href={i.url} target="_blank" rel="noreferrer" className="text-[13px] font-medium text-ink hover:underline">{i.title}</a>
              <div className="text-[11.5px] text-muted">{KIND_LABEL[i.kind]} · {[i.publisher, i.year].filter(Boolean).join(" · ")} · <Link className="text-accent hover:underline" href={i.scope === "cluster" ? `/story/${i.refId}` : i.scope === "project" ? `/research/${i.refId}` : `/experts?q=${encodeURIComponent(i.refId)}`}>from this library</Link></div>
              {i.snippet && <p className="line-clamp-2 text-[12.5px] text-ink-2">{i.snippet}</p>}
            </li>
          ))}
          {!kept.length && <p className="py-3 text-[12.5px] text-muted">Nothing kept yet — press ☆ on any item.</p>}
        </ul>
      )}
    </div>
  );
}
