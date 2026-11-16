import Link from "next/link";
import { getDb } from "@/lib/db";
import { searchAll } from "@/lib/repo/search";
import type { SearchKind } from "@/lib/repo/search-index";
import { listProjects } from "@/lib/repo/projects";
import { ANSWER_STATE_LABELS, SOURCE_KINDS } from "@/lib/types";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const KINDS: { id: SearchKind; label: string }[] = [
  { id: "cluster", label: "Stories" },
  { id: "article", label: "Articles" },
  { id: "question", label: "Questions" },
  { id: "answer", label: "Answers" },
  { id: "source", label: "Sources" },
  { id: "note", label: "Notes" },
  { id: "project", label: "Projects" },
];

/** Render FTS snippet markers [[…]] as highlights without injecting HTML. */
function Snippet({ text }: { text: string }) {
  const parts = text.split(/(\[\[[^\]]*\]\])/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("[[") ? <mark key={i} className="rounded-sm bg-accent-soft px-0.5 text-ink">{p.slice(2, -2)}</mark> : <span key={i}>{p}</span>,
      )}
    </>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const db = getDb();
  const q = sp.q?.trim() ?? "";
  const kinds = (sp.kinds ?? "").split(",").filter(Boolean) as SearchKind[];
  const hits = q
    ? searchAll(db, q, { kinds, from: sp.from || undefined, to: sp.to || undefined, sourceKind: sp.sourceKind || undefined, publisher: sp.publisher || undefined, projectId: sp.project || undefined, answerState: sp.state || undefined, limit: 150 })
    : [];
  const byKind = new Map<string, number>();
  for (const h of hits) byKind.set(h.kind, (byKind.get(h.kind) ?? 0) + 1);
  const projects = listProjects(db);
  const publishers = (db.prepare("SELECT name FROM feeds ORDER BY name").all() as { name: string }[]).map((r) => r.name);
  const label = Object.fromEntries(KINDS.map((k) => [k.id, k.label.replace(/s$/, "")]));

  const kindHref = (k?: string) => {
    const next = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    if (k) next.set("kinds", k);
    else next.delete("kinds");
    return `/search?${next.toString()}`;
  };

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="mb-4 font-serif text-[28px] font-semibold tracking-tight">Search</h1>
      <form action="/search" className="space-y-2">
        {kinds.length > 0 && <input type="hidden" name="kinds" value={kinds.join(",")} />}
        <div className="flex gap-2">
          <input name="q" defaultValue={q} autoFocus placeholder="Search stories, articles, questions, answers, sources, notes and projects…" className="input !py-2 text-[15px]" />
          <button className="btn-primary !px-4">Search</button>
        </div>
        <details className="text-[13px]" open={!!(sp.from || sp.to || sp.sourceKind || sp.publisher || sp.project || sp.state)}>
          <summary className="cursor-pointer text-muted hover:text-ink">Filters</summary>
          <div className="mt-2 flex flex-wrap gap-2">
            <label className="flex items-center gap-1 text-muted">From <input type="date" name="from" defaultValue={sp.from} className="input !w-auto !py-1" /></label>
            <label className="flex items-center gap-1 text-muted">To <input type="date" name="to" defaultValue={sp.to} className="input !w-auto !py-1" /></label>
            <select name="publisher" defaultValue={sp.publisher ?? ""} className="input !w-auto !py-1">
              <option value="">Any outlet</option>
              {publishers.map((p) => <option key={p}>{p}</option>)}
            </select>
            <select name="sourceKind" defaultValue={sp.sourceKind ?? ""} className="input !w-auto !py-1">
              <option value="">Any source type</option>
              {SOURCE_KINDS.map((k) => <option key={k}>{k}</option>)}
            </select>
            <select name="state" defaultValue={sp.state ?? ""} className="input !w-auto !py-1">
              <option value="">Any research status</option>
              {Object.entries(ANSWER_STATE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select name="project" defaultValue={sp.project ?? ""} className="input !w-auto !py-1">
              <option value="">Any project</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
        </details>
      </form>

      {q && (
        <>
          <div className="mt-5 flex flex-wrap gap-1 border-b border-line">
            <Link href={kindHref()} className={`-mb-px border-b-2 px-3 py-2 text-[13px] font-medium ${kinds.length === 0 ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}>
              All <span className="text-muted">{hits.length}</span>
            </Link>
            {KINDS.map((k) => (
              <Link key={k.id} href={kindHref(k.id)} className={`-mb-px border-b-2 px-3 py-2 text-[13px] font-medium ${kinds.length === 1 && kinds[0] === k.id ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}>
                {k.label} {kinds.length === 0 && <span className="text-muted">{byKind.get(k.id) ?? 0}</span>}
              </Link>
            ))}
          </div>
          {hits.length === 0 ? (
            <p className="py-10 text-center text-[13.5px] text-muted">No results for “{q}”.</p>
          ) : (
            <ul className="divide-y divide-line">
              {hits.map((h) => (
                <li key={h.kind + h.id} className="py-3">
                  <div className="mb-0.5 flex items-center gap-2 text-[11.5px] uppercase tracking-wide text-muted">
                    <span className="font-semibold">{label[h.kind]}</span>
                    {h.meta && <span className="normal-case tracking-normal">· {h.meta}</span>}
                    {h.date && <span className="normal-case tracking-normal">· {fmtDate(h.date)}</span>}
                  </div>
                  <Link href={h.href} className="text-[15px] font-medium leading-snug text-ink hover:underline">{h.title}</Link>
                  {h.snippet && <p className="mt-0.5 line-clamp-2 text-[13px] text-ink-2"><Snippet text={h.snippet} /></p>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {!q && <p className="mt-6 text-[13px] text-muted">Local full-text search across everything you have collected and written. Runs on your machine; no AI and no network.</p>}
    </div>
  );
}
