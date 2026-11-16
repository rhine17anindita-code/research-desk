import Link from "next/link";
import { getDb } from "@/lib/db";
import { listProjects } from "@/lib/repo/projects";
import { getSetting } from "@/lib/repo/settings";
import { NewProject } from "@/components/ProjectComponents";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function ResearchPage() {
  const db = getDb();
  const projects = listProjects(db);
  const stages = getSetting(db, "pipeline.stages");
  const known = new Set(stages.map((s) => s.id));
  const columns = [...stages, ...(projects.some((p) => !known.has(p.stage)) ? [{ id: "__other", label: "Other" }] : [])];

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-[28px] font-semibold tracking-tight">Research</h1>
          <p className="text-[13px] text-muted">Investigations move from discovery to publication. Edit the pipeline stages in Settings.</p>
        </div>
      </header>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex gap-3 overflow-x-auto pb-3">
          {columns.map((col) => {
            const items = projects.filter((p) => (col.id === "__other" ? !known.has(p.stage) : p.stage === col.id));
            return (
              <section key={col.id} className="w-[250px] shrink-0">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="eyebrow">{col.label}</span>
                  <span className="text-[11.5px] text-muted">{items.length}</span>
                </div>
                <div className="flex min-h-[120px] flex-col gap-2 rounded-lg bg-surface-2/60 p-1.5">
                  {items.map((p) => (
                    <Link key={p.id} href={`/research/${p.id}`} className="card block px-3 py-2.5 hover:border-line-strong">
                      <div className="font-serif text-[15px] font-semibold leading-snug">{p.title}</div>
                      {p.thesis && <p className="mt-1 line-clamp-2 text-[12.5px] text-ink-2">{p.thesis}</p>}
                      <div className="mt-1.5 flex flex-wrap gap-x-2 text-[11.5px] text-muted">
                        <span>{p.counts.cluster ?? 0} stories</span>
                        <span>{p.counts.question ?? 0} questions</span>
                        <span>{p.counts.source ?? 0} sources</span>
                        <span>{p.counts.note ?? 0} notes</span>
                      </div>
                      <div className="mt-1 text-[11px] text-muted">updated {timeAgo(p.updatedAt)}</div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
        <div className="space-y-4">
          <NewProject />
          <p className="text-[12.5px] leading-relaxed text-muted">
            You can also add stories, questions and sources to a project from anywhere using <b>Add to project</b>.
          </p>
        </div>
      </div>
    </div>
  );
}
