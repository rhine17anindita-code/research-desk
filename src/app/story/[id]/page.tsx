import Link from "next/link";
import { StoryLens } from "@/components/StoryLens";
import { getNote, storyLens } from "@/lib/ideation/lens";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getDb } from "@/lib/db";
import { getStory, getStoryArticles, markViewed, relatedStories } from "@/lib/repo/stories";
import { listQuestions } from "@/lib/repo/questions";
import { listNotes, projectsContaining } from "@/lib/repo/projects";
import { linksFor } from "@/lib/repo/links";
import { detectSignals } from "@/lib/signals";
import { loadPrefs } from "@/lib/ranking";
import { StoryResearch } from "@/components/research/StoryResearch";
import { NotesPanel } from "@/components/research/NotesPanel";
import { AddToProject, Connections } from "@/components/research/Connections";
import { BriefButton, StoryFeedback } from "@/components/StoryActions";
import { Icon } from "@/components/Icon";
import { TrackVisit } from "@/components/CommandPalette";
import { OriginBadge } from "@/components/research/Badges";
import { MergeStory } from "@/components/MergeStory";
import { StoryShell } from "@/components/StoryShell";
import { MediaPanel } from "@/components/MediaPanel";
import { fmtDate, timeAgo } from "@/lib/format";

/** How much of each article the app could read (what research and scripts work from). */
const TEXT_LABEL: Record<string, [string, string]> = {
  full: ["full article", "bg-ok-soft text-ok"],
  summary: ["short page (video, live update or paywall)", "bg-warn-soft text-warn"],
  headline: ["headline only", "bg-surface-2 text-muted"],
  blocked: ["fetching from your Mac…", "bg-accent-soft text-accent"],
};

export const dynamic = "force-dynamic";

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const story = getStory(db, id);
  if (!story) notFound();
  markViewed(db, id);
  const articles = getStoryArticles(db, id);
  const questions = listQuestions(db, { clusterId: id });
  const notes = listNotes(db, { clusterId: id });
  const related = relatedStories(db, id);
  const projects = projectsContaining(db, "cluster", id);
  const links = linksFor(db, "cluster", id);
  const prefs = loadPrefs(db);
  const signals = detectSignals([story.headline, story.summary ?? "", ...articles.map((a) => `${a.title} ${a.summary ?? ""}`)].join(" "), prefs.signals.filter((s) => s.enabled));
  const labels = Object.fromEntries(prefs.signals.map((s) => [s.id, s.label]));

  const lens = storyLens(db, story.id);
  return (
    <div className="px-4 py-5 sm:px-6 lg:px-8">
      <TrackVisit kind="story" title={story.headline} href={`/story/${story.id}`} />
      <div className="mb-4 flex items-center gap-2 text-[12.5px] text-muted">
        <Link href="/discover" className="hover:text-ink"><Icon name="arrowLeft" size={13} className="inline" /> Discover</Link>
        <span>/</span>
        <Link href="/explore" className="hover:text-ink">Explore</Link>
      </div>

      <StoryShell
        headline={story.headline}
        left={
        <aside className="min-w-0 space-y-5 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:pr-1">
          <div>
            {story.isSample && <div className="mb-2 inline-block rounded bg-warn-soft px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-wide text-warn">Sample · fictional story</div>}
            <h1 className="font-serif text-[23px] font-semibold leading-tight tracking-tight">{story.headline}</h1>
            <div className="mt-1.5 text-[12.5px] text-muted">
              {story.sourceCount} outlet{story.sourceCount === 1 ? "" : "s"} · {story.articleCount} article{story.articleCount === 1 ? "" : "s"} · first seen {fmtDate(story.firstSeenAt, true)} · updated {timeAgo(story.lastUpdatedAt)}
            </div>
            <div className="mt-2"><StoryFeedback id={story.id} state={story.state} rating={story.rating} /></div>
          </div>

          {lens && <StoryLens clusterId={story.id} lens={lens} note={getNote(db, story.id)} />}

          {story.summary && (
            <div>
              <div className="eyebrow mb-1">From the coverage</div>
              <p className="text-[13.5px] leading-relaxed text-ink-2">{story.summary}</p>
            </div>
          )}

          <div className="rounded-lg border border-ai/20 bg-ai-soft/40 p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5"><OriginBadge origin="ai" /><span className="eyebrow">Brief</span></span>
              <BriefButton id={story.id} has={!!story.brief} />
            </div>
            {story.brief ? (
              <div className="space-y-2 text-[13px] leading-relaxed text-ink-2">
                <p>{story.brief.explanation}</p>
                <p><span className="font-medium text-ink">Why it matters: </span>{story.brief.whyItMatters}</p>
                {story.brief.coverageDifferences.length > 0 && (
                  <div>
                    <div className="font-medium text-ink">Differences in coverage</div>
                    <ul className="list-disc pl-4">{story.brief.coverageDifferences.map((d, i) => <li key={i}>{d}</li>)}</ul>
                  </div>
                )}
                {story.brief.unknowns.length > 0 && (
                  <div>
                    <div className="font-medium text-ink">Left unclear</div>
                    <ul className="list-disc pl-4">{story.brief.unknowns.map((d, i) => <li key={i}>{d}</li>)}</ul>
                  </div>
                )}
                <p className="text-[11px] text-muted">AI interpretation of the coverage below · {story.brief.model} · {timeAgo(story.brief.generatedAt)}</p>
              </div>
            ) : (
              <p className="text-[12.5px] text-muted">Optional: a short explanation drawn only from the coverage. Saved once generated.</p>
            )}
          </div>

          {(signals.length > 0 || story.assessment) && (
            <div>
              <div className="eyebrow mb-1.5">Editorial signals</div>
              <div className="flex flex-wrap gap-1.5">
                {signals.map((s) => (
                  <span key={s.signalId} className="chip border-accent/25 bg-accent-soft/60 text-accent" title={`Cue: ${s.matches.join(", ")}`}>{labels[s.signalId]}</span>
                ))}
              </div>
              {story.assessment && (
                <div className="mt-2 text-[12.5px] text-ink-2">
                  <span className="mr-1"><OriginBadge origin="ai" /></span>
                  {story.assessment.note}
                  <ul className="mt-1 space-y-0.5 text-muted">
                    {story.assessment.signals.map((s) => <li key={s.id}>{labels[s.id] ?? s.id}: {s.reason}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div>
            <div className="eyebrow mb-1.5">Coverage · timeline</div>
            <div className="mb-2"><MergeStory id={story.id} /></div>
            <ol className="relative space-y-2.5 border-l border-line pl-3.5">
              {articles.map((a) => (
                <li key={a.id} className="relative">
                  <span className="absolute -left-[18px] top-1.5 h-2 w-2 rounded-full border border-line-strong bg-surface" />
                  <div className="text-[11.5px] text-muted">
                    {a.publisher} · {fmtDate(a.publishedAt ?? a.fetchedAt, true)}
                    {a.textStatus && TEXT_LABEL[a.textStatus] && <span className={`ml-1.5 rounded-full px-1.5 py-px text-[10.5px] font-medium ${TEXT_LABEL[a.textStatus][1]}`}>{TEXT_LABEL[a.textStatus][0]}</span>}
                  </div>
                  <a href={a.directUrl || a.url} target="_blank" rel="noreferrer" className="block text-[13px] font-medium leading-snug text-ink hover:underline">
                    {a.title} <Icon name="external" size={11} className="inline text-muted" />
                  </a>
                  {a.summary && <p className="mt-0.5 line-clamp-3 text-[12.5px] leading-relaxed text-ink-2">{a.summary}</p>}
                </li>
              ))}
            </ol>
          </div>

          <div>
            <div className="eyebrow mb-1.5">Visuals & media</div>
            <MediaPanel initialQuery={story.entities.slice(0, 2).join(" ") || story.headline.split(" ").slice(0, 6).join(" ")} compact />
          </div>

          {story.entities.length > 0 && (
            <div>
              <div className="eyebrow mb-1.5">Names in the coverage</div>
              <div className="flex flex-wrap gap-1">
                {story.entities.slice(0, 14).map((e) => (
                  <Link key={e} href={`/search?q=${encodeURIComponent(e)}`} className="chip hover:border-accent hover:text-accent">{e}</Link>
                ))}
              </div>
            </div>
          )}

          {related.length > 0 && (
            <div>
              <div className="eyebrow mb-1.5">Related stories</div>
              <ul className="space-y-2">
                {related.map((r) => (
                  <li key={r.story.id}>
                    <Link href={`/story/${r.story.id}`} className="block text-[13px] leading-snug text-ink-2 hover:text-ink hover:underline">{r.story.headline}</Link>
                    <span className="text-[11.5px] text-muted">{timeAgo(r.story.lastUpdatedAt)} · shares {r.shared.slice(0, 3).join(", ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="eyebrow mb-1.5">Projects</div>
            <AddToProject itemType="cluster" itemId={story.id} current={projects} />
          </div>
          <Connections type="cluster" id={story.id} initial={links} />
          <NotesPanel notes={notes} clusterId={story.id} />
        </aside>
        }
      >
        <Suspense>
          <StoryResearch clusterId={story.id} initialQuestions={questions} />
        </Suspense>
      </StoryShell>
    </div>
  );
}
