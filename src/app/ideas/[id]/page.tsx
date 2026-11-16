import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getIdea, getInspiration } from "@/lib/ideation/repo";
import { backingFor } from "@/lib/ideation/backing";
import { IdeaCard } from "@/components/ideas/IdeaCard";
import { IdeaActions } from "@/components/ideas/IdeaActions";
import { GeneratePanel } from "@/components/ideas/GeneratePanel";
import { Icon } from "@/components/Icon";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function IdeaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const idea = getIdea(db, id);
  if (!idea) notFound();
  const backing = backingFor(db, [idea])[idea.id];
  const insp = idea.inspirationId ? getInspiration(db, idea.inspirationId) : null;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <Link href="/ideas/saved" className="mb-3 inline-block text-[12.5px] text-muted hover:text-ink"><Icon name="arrowLeft" size={13} className="inline" /> Saved ideas</Link>
        <IdeaCard idea={idea} backing={backing} />
        <div className="mt-3"><IdeaActions idea={idea} /></div>
      </div>
      <aside className="space-y-4">
        <div className="card p-4 text-[12.5px] text-muted">
          <div>Status: <span className="font-medium text-ink">{idea.status}</span>{idea.reason ? ` — ${idea.reason}` : ""}</div>
          <div>Created {fmtDate(idea.createdAt, true)}</div>
          {insp && <div className="mt-1">Inspired by: <Link className="text-accent hover:underline" href={`/ideas/inspiration#${insp.id}`}>{insp.title ?? insp.url}</Link></div>}
        </div>
        {backing.stories.length > 0 && (
          <div>
            <div className="eyebrow mb-2">More ideas from the same research</div>
            <GeneratePanel clusterIds={backing.stories.map((s) => s.id)} compact label="Generate variations" />
          </div>
        )}
      </aside>
    </div>
  );
}
