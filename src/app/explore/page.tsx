import Link from "next/link";
import { getDb } from "@/lib/db";
import { recentlyViewed, storiesUnderInvestigation } from "@/lib/repo/stories";
import { listQuestions } from "@/lib/repo/questions";
import { StateBadge } from "@/components/research/Badges";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function ExplorePage() {
  const db = getDb();
  const investigating = storiesUnderInvestigation(db, 40);
  const recent = recentlyViewed(db, 10).filter((s) => !investigating.some((i) => i.id === s.id));
  const openQuestions = (db.prepare(
    `SELECT id FROM questions WHERE archived = 0 AND answer_state IN ('needs-investigation', 'open', 'contested', 'partial') ORDER BY followed DESC, priority ASC, updated_at DESC LIMIT 12`,
  ).all() as { id: string }[]).map((r) => r.id);
  const qs = listQuestions(db, { ids: openQuestions });

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="font-serif text-[28px] font-semibold tracking-tight">Explore</h1>
        <p className="text-[13px] text-muted">Stories you are studying, and the questions still open across them.</p>
      </header>
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <section>
          <div className="eyebrow mb-2">Stories under investigation</div>
          {investigating.length === 0 ? (
            <div className="card px-5 py-8 text-center text-[13.5px] text-muted">
              Nothing yet. Open a story from <Link href="/discover" className="text-accent hover:underline">Discover</Link>, save it, or generate questions — it will appear here.
            </div>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
              {investigating.map((s) => (
                <li key={s.id} className="px-4 py-3">
                  <Link href={`/story/${s.id}`} className="font-serif text-[16.5px] font-semibold leading-snug hover:underline">{s.headline}</Link>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-[12px] text-muted">
                    {s.isSample && <span className="font-semibold uppercase text-warn">Sample</span>}
                    <span>{s.questionCount} question{s.questionCount === 1 ? "" : "s"}</span>
                    <span>{s.answeredCount} answered</span>
                    <span>{s.sourceCount} outlet{s.sourceCount === 1 ? "" : "s"}</span>
                    {s.state === "saved" && <span className="text-accent">Saved</span>}
                    <span>updated {timeAgo(s.lastUpdatedAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {recent.length > 0 && (
            <>
              <div className="eyebrow mb-2 mt-8">Recently opened</div>
              <ul className="space-y-1.5">
                {recent.map((s) => (
                  <li key={s.id}><Link href={`/story/${s.id}`} className="text-[13.5px] text-ink-2 hover:text-ink hover:underline">{s.headline}</Link></li>
                ))}
              </ul>
            </>
          )}
        </section>
        <aside>
          <div className="eyebrow mb-2">Open questions</div>
          {qs.length === 0 ? (
            <p className="text-[13px] text-muted">Questions that need investigation, are contested or only partly answered will collect here.</p>
          ) : (
            <ul className="space-y-2">
              {qs.map((q) => (
                <li key={q.id} className="card px-3 py-2.5">
                  <div className="mb-1"><StateBadge state={q.answerState} /></div>
                  <Link href={`/question/${q.id}`} className="text-[13.5px] font-medium leading-snug text-ink hover:underline">{q.text}</Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
