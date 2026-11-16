import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { questionDetail } from "@/lib/research/question-detail";
import { QuestionWorkspace } from "@/components/research/QuestionWorkspace";
import { DimensionLabel, OriginBadge, StateBadge } from "@/components/research/Badges";
import { Icon } from "@/components/Icon";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function QuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = questionDetail(getDb(), id);
  if (!d) notFound();
  const q = d.question;
  return (
    <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
        {d.story ? (
          <Link href={`/story/${d.story.id}?q=${q.id}`} className="hover:text-ink"><Icon name="arrowLeft" size={13} className="inline" /> {d.story.headline}</Link>
        ) : (
          <Link href="/explore" className="hover:text-ink"><Icon name="arrowLeft" size={13} className="inline" /> Explore</Link>
        )}
      </div>
      <header className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <StateBadge state={q.answerState} />
          <DimensionLabel dimension={q.dimension} />
          <OriginBadge origin={q.origin} />
          <span className="text-[12px] text-muted">asked {fmtDate(q.createdAt)}</span>
        </div>
        <h1 className="max-w-4xl font-serif text-[26px] font-semibold leading-snug tracking-tight">{q.text}</h1>
        {q.rationale && <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-ink-2">{q.rationale}</p>}
        {d.parent && (
          <p className="mt-2 text-[13px] text-muted">
            Follow-up to <Link className="text-accent hover:underline" href={`/question/${d.parent.id}`}>{d.parent.text}</Link>
          </p>
        )}
      </header>
      <QuestionWorkspace initial={d} />
    </div>
  );
}
