import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getSource, sourceUsage } from "@/lib/repo/sources";
import { projectsContaining } from "@/lib/repo/projects";
import { getArticle } from "@/lib/repo/stories";
import { SourceEditor } from "@/components/LibraryClient";
import { AddToProject, Connections } from "@/components/research/Connections";
import { Icon } from "@/components/Icon";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const PROVIDER: Record<string, string> = { feed: "an RSS feed you follow", openalex: "OpenAlex", crossref: "Crossref", wikipedia: "Wikipedia", gdelt: "the GDELT news index", user: "you, by hand" };

export default async function SourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const s = getSource(db, id);
  if (!s) notFound();
  const usage = sourceUsage(db, id);
  const article = s.articleId ? getArticle(db, s.articleId) : null;
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 text-[12.5px] text-muted"><Link href="/library" className="hover:text-ink"><Icon name="arrowLeft" size={13} className="inline" /> Library</Link></div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <div className="eyebrow mb-1">{s.kind}</div>
          <h1 className="font-serif text-[24px] font-semibold leading-snug tracking-tight">{s.title}</h1>
          <div className="mt-1 text-[13px] text-muted">{[s.authors, s.publisher, fmtDate(s.publishedAt)].filter(Boolean).join(" · ")}</div>
          {s.url && (
            <a href={s.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[13px] text-accent hover:underline">
              Open original <Icon name="external" size={12} />
            </a>
          )}
          <dl className="mt-4 grid grid-cols-[140px_1fr] gap-y-1 rounded-lg border border-line bg-surface p-3 text-[12.5px]">
            <dt className="text-muted">Found via</dt><dd>{PROVIDER[s.provider] ?? s.provider}</dd>
            <dt className="text-muted">Retrieved</dt><dd>{fmtDate(s.retrievedAt, true)}</dd>
            {s.doi && (<><dt className="text-muted">DOI</dt><dd>{s.doi}</dd></>)}
            {article?.clusterId && (<><dt className="text-muted">Story</dt><dd><Link className="text-accent hover:underline" href={`/story/${article.clusterId}`}>Open the story this article belongs to</Link></dd></>)}
          </dl>

          <div className="mt-6">
            <div className="eyebrow mb-2">Supports</div>
            {usage.evidence.length === 0 && usage.questions.length === 0 ? (
              <p className="text-[13px] text-muted">Not yet attached to any question or cited in an answer.</p>
            ) : (
              <ul className="space-y-2">
                {usage.evidence.map((e, i) => (
                  <li key={i} className="rounded-md border border-line bg-surface px-3 py-2 text-[13px]">
                    <div className="text-ink-2">“{e.claim}”</div>
                    <div className="mt-1 text-[12px] text-muted">{e.relation} · answer to <Link className="text-accent hover:underline" href={`/question/${e.question_id}`}>{e.question}</Link></div>
                  </li>
                ))}
                {usage.questions.filter((q) => !usage.evidence.some((e) => e.question_id === q.id)).map((q) => (
                  <li key={q.id} className="text-[13px]">
                    <span className="text-muted">{q.status} for </span><Link className="text-accent hover:underline" href={`/question/${q.id}`}>{q.text}</Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-6 space-y-4">
            <div><div className="eyebrow mb-1.5">Projects</div><AddToProject itemType="source" itemId={s.id} current={projectsContaining(db, "source", s.id)} /></div>
            <Connections type="source" id={s.id} />
          </div>
        </div>
        <aside className="card p-4">
          <div className="eyebrow mb-2">Record</div>
          <SourceEditor source={s} />
        </aside>
      </div>
    </div>
  );
}
