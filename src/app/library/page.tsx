import Link from "next/link";
import { getDb } from "@/lib/db";
import { listLibrary } from "@/lib/repo/sources";
import { listNotes } from "@/lib/repo/projects";
import { rankFeed } from "@/lib/ranking";
import { SOURCE_KINDS } from "@/lib/types";
import { NotesPanel } from "@/components/research/NotesPanel";
import { LibraryAddSource } from "@/components/LibraryClient";
import { fmtDate, hostOf, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | undefined>>;

export default async function LibraryPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const tab = sp.tab ?? "sources";
  const db = getDb();
  const tabs = [
    ["sources", "Sources"],
    ["stories", "Saved stories"],
    ["notes", "Notes"],
    ["articles", "Collected articles"],
  ];

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-4">
        <h1 className="font-serif text-[28px] font-semibold tracking-tight">Library</h1>
        <p className="text-[13px] text-muted">Everything you have collected: sources with their provenance, saved stories, notes and the article archive.</p>
      </header>
      <div className="mb-4 flex gap-1 border-b border-line">
        {tabs.map(([id, label]) => (
          <Link key={id} href={`/library?tab=${id}`} className={`-mb-px border-b-2 px-3 py-2 text-[13.5px] font-medium ${tab === id ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}>
            {label}
          </Link>
        ))}
      </div>

      {tab === "sources" && <SourcesTab sp={sp} />}
      {tab === "stories" && (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {rankFeed(db, { view: "saved", limit: 200 }).items.map((s) => (
            <li key={s.id} className="px-4 py-3">
              <Link href={`/story/${s.id}`} className="font-serif text-[16px] font-semibold hover:underline">{s.headline}</Link>
              <div className="text-[12px] text-muted">{s.publishers.slice(0, 3).join(" · ")} · {timeAgo(s.lastUpdatedAt)} · {s.questionCount} questions</div>
            </li>
          ))}
          {rankFeed(db, { view: "saved", limit: 1 }).items.length === 0 && <li className="px-4 py-6 text-center text-[13px] text-muted">No saved stories yet.</li>}
        </ul>
      )}
      {tab === "notes" && (
        <div className="max-w-3xl">
          <NotesPanel notes={listNotes(db, { all: true })} title="All notes" />
        </div>
      )}
      {tab === "articles" && <ArticlesTab q={sp.q} />}
    </div>
  );
}

function SourcesTab({ sp }: { sp: Record<string, string | undefined> }) {
  const db = getDb();
  const sources = listLibrary(db, { kind: sp.kind, provider: sp.provider, q: sp.q });
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div>
        <form className="mb-3 flex flex-wrap gap-2" action="/library">
          <input type="hidden" name="tab" value="sources" />
          <input name="q" defaultValue={sp.q} placeholder="Search sources…" className="input !w-56 flex-1" />
          <select name="kind" defaultValue={sp.kind ?? ""} className="input !w-auto">
            <option value="">All types</option>
            {SOURCE_KINDS.map((k) => <option key={k}>{k}</option>)}
          </select>
          <select name="provider" defaultValue={sp.provider ?? ""} className="input !w-auto">
            <option value="">Any origin</option>
            <option value="user">Added by you</option>
            <option value="feed">Your feeds</option>
            <option value="openalex">OpenAlex</option>
            <option value="crossref">Crossref</option>
            <option value="wikipedia">Wikipedia</option>
            <option value="gdelt">GDELT</option>
          </select>
          <button className="btn">Filter</button>
        </form>
        {sources.length === 0 ? (
          <div className="card px-5 py-8 text-center text-[13.5px] text-muted">
            No sources in your library yet. Sources appear here when you attach them to a question, when an answer cites them, or when you add them by hand.
          </div>
        ) : (
          <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-lg border border-line bg-surface text-[13px]">
            <thead>
              <tr className="text-left text-[11.5px] uppercase tracking-wide text-muted">
                <th className="border-b border-line px-3 py-2 font-semibold">Source</th>
                <th className="hidden border-b border-line px-3 py-2 font-semibold md:table-cell">Type</th>
                <th className="hidden border-b border-line px-3 py-2 font-semibold md:table-cell">Date</th>
                <th className="border-b border-line px-3 py-2 text-right font-semibold">Used</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id} className="align-top hover:bg-surface-2/50">
                  <td className="border-b border-line px-3 py-2">
                    <Link href={`/library/source/${s.id}`} className="font-medium text-ink hover:underline">{s.title}</Link>
                    <div className="text-[12px] text-muted">{[s.publisher ?? hostOf(s.url), s.authors?.slice(0, 60)].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td className="hidden border-b border-line px-3 py-2 text-muted md:table-cell">{s.kind}</td>
                  <td className="hidden whitespace-nowrap border-b border-line px-3 py-2 text-muted md:table-cell">{fmtDate(s.publishedAt)}</td>
                  <td className="border-b border-line px-3 py-2 text-right tabular-nums text-muted">{s.usedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <LibraryAddSource />
    </div>
  );
}

function ArticlesTab({ q }: { q?: string }) {
  const db = getDb();
  const rows = q
    ? (db.prepare(`SELECT a.* FROM articles a WHERE a.id IN (SELECT ref_id FROM search_index WHERE kind = 'article' AND search_index MATCH ?) ORDER BY COALESCE(a.published_at, a.fetched_at) DESC LIMIT 200`).all(
        (q.match(/[\p{L}\p{N}]+/gu) ?? []).map((t) => `"${t}"*`).join(" AND ") || '""',
      ) as { id: string; title: string; url: string; publisher: string; published_at: string | null; cluster_id: string | null }[])
    : (db.prepare("SELECT * FROM articles ORDER BY COALESCE(published_at, fetched_at) DESC LIMIT 200").all() as { id: string; title: string; url: string; publisher: string; published_at: string | null; cluster_id: string | null }[]);
  return (
    <div>
      <form className="mb-3 flex gap-2" action="/library">
        <input type="hidden" name="tab" value="articles" />
        <input name="q" defaultValue={q} placeholder="Search collected articles…" className="input max-w-md" />
        <button className="btn">Search</button>
      </form>
      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {rows.map((a) => (
          <li key={a.id} className="flex items-start gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <a href={a.url} target="_blank" rel="noreferrer" className="text-[13.5px] font-medium text-ink hover:underline">{a.title}</a>
              <div className="text-[12px] text-muted">{a.publisher} · {timeAgo(a.published_at)}</div>
            </div>
            {a.cluster_id && <Link href={`/story/${a.cluster_id}`} className="shrink-0 text-[12px] text-accent hover:underline">Story →</Link>}
          </li>
        ))}
      </ul>
    </div>
  );
}
