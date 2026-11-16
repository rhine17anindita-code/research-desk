import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getProject, listNotes, projectItemIds } from "@/lib/repo/projects";
import { getStory } from "@/lib/repo/stories";
import { listQuestions } from "@/lib/repo/questions";
import { getSources, questionSources } from "@/lib/repo/sources";
import { getSetting } from "@/lib/repo/settings";
import { DeleteProject, ProjectField, ProjectQuestions, ProjectSide, RemoveItem, StageSelect } from "@/components/ProjectComponents";
import { NotesPanel } from "@/components/research/NotesPanel";
import { Icon } from "@/components/Icon";
import { timeAgo } from "@/lib/format";
import type { Source } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const project = getProject(db, id);
  if (!project) notFound();
  const stages = getSetting(db, "pipeline.stages");
  const stories = projectItemIds(db, id, "cluster").map((cid) => getStory(db, cid)).filter((s): s is NonNullable<typeof s> => !!s);
  const questions = listQuestions(db, { projectId: id });
  const notes = listNotes(db, { projectId: id });

  // Evidence library: directly added sources + sources attached to the project's questions.
  const map = new Map<string, Source & { via?: string }>();
  for (const s of getSources(db, projectItemIds(db, id, "source"))) map.set(s.id, { ...s, via: "added to project" });
  for (const q of questions) for (const s of questionSources(db, q.id, ["attached"])) if (!map.has(s.id)) map.set(s.id, { ...s, via: `for: ${q.text.slice(0, 60)}${q.text.length > 60 ? "…" : ""}` });
  const sources = [...map.values()];

  const open = questions.filter((q) => ["needs-investigation", "open", "contested", "unexamined", "insufficient"].includes(q.answerState)).length;

  return (
    <div className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-3 flex items-center justify-between text-[12.5px] text-muted">
        <Link href="/research" className="hover:text-ink"><Icon name="arrowLeft" size={13} className="inline" /> Research</Link>
        <DeleteProject id={id} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-6">
          <header className="space-y-3">
            <ProjectField id={id} field="title" value={project.title} placeholder="Working title" multiline={false} big />
            <div className="flex flex-wrap items-center gap-3 text-[12.5px] text-muted">
              <StageSelect id={id} stage={project.stage} stages={stages} />
              <span>{stories.length} stories · {questions.length} questions ({open} open) · {sources.length} sources · updated {timeAgo(project.updatedAt)}</span>
            </div>
            <ProjectField id={id} field="thesis" value={project.thesis} label="Research question / thesis" placeholder="What are you trying to establish?" />
          </header>

          <section>
            <div className="eyebrow mb-2">Stories</div>
            {stories.length === 0 ? (
              <p className="text-[13px] text-muted">Add stories from Discover or a story page with <b>Add to project</b>.</p>
            ) : (
              <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
                {stories.map((s) => (
                  <li key={s.id} className="group flex items-start gap-2 px-3.5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <Link href={`/story/${s.id}`} className="font-serif text-[15.5px] font-semibold leading-snug hover:underline">{s.headline}</Link>
                      <div className="text-[12px] text-muted">{s.sourceCount} outlets · updated {timeAgo(s.lastUpdatedAt)}</div>
                    </div>
                    <RemoveItem projectId={id} itemType="cluster" itemId={s.id} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <ProjectQuestions projectId={id} initial={questions} />
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <ProjectField id={id} field="gaps" value={project.gaps} label="Remaining research gaps" placeholder="What still needs evidence, documents, interviews…" />
            <ProjectField id={id} field="angles" value={project.angles} label="Editorial angles" placeholder="Explainer, investigation, data piece, short video…" />
          </section>
          <ProjectField id={id} field="description" value={project.description} label="Working notes / outline" placeholder="Structure, sequence, key scenes, what to show…" />

          <NotesPanel notes={notes} projectId={id} />
        </div>
        <aside className="min-w-0 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
          <ProjectSide projectId={id} sources={sources} />
        </aside>
      </div>
    </div>
  );
}
