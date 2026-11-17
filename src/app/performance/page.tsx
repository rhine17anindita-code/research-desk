import { getDb } from "@/lib/db";
import { activeChannel } from "@/lib/channels";
import { getSetting } from "@/lib/repo/settings";
import { commentScan, LABEL, performance, type Pattern, type RankedPost } from "@/lib/performance/patterns";
import { latestReport } from "@/lib/performance/store";
import { syncYoutubeIfStale } from "@/lib/performance/youtube-sync";
import { syncMetaIfStale } from "@/lib/performance/meta";
import { MetaConnect } from "@/components/performance/MetaConnect";
import { SectionRefresh } from "@/components/SectionRefresh";
import type { CommentInsights, StrategyReport } from "@/lib/performance/ai";
import { getIdea, type Idea } from "@/lib/ideation/repo";
import { backingFor } from "@/lib/ideation/backing";
import { timeAgo } from "@/lib/format";
import { youtubeConfigured } from "@/lib/media";
import { CommentsButton, ImportPanel, StrategyButton, SyncButton } from "@/components/performance/PerfClient";
import { IdeaCard } from "@/components/ideas/IdeaCard";
import { IdeaQuickActions } from "@/components/studio/InlineIdeas";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(Math.round(n)));
const lx = (n: number) => `${n >= 10 ? Math.round(n) : n.toFixed(1)}×`;
const COLOR: Record<string, string> = { youtube: "bg-[#ff3b30]", instagram: "bg-[#c13584]", facebook: "bg-[#1877f2]", tiktok: "bg-ink" };

/** Your own numbers across platforms: what works, what your audience says, and what to make next. */
export default async function PerformancePage() {
  const db = getDb();
  const ch = activeChannel(db);
  if (youtubeConfigured() && ch.links.youtube) await syncYoutubeIfStale(db, 6);
  await syncMetaIfStale(db, 6);
  const perf = performance(db);
  const scan = commentScan(db);
  const strategy = latestReport<StrategyReport>(db, "strategy");
  const comments = latestReport<CommentInsights>(db, "comments");
  const ideasOf = (ids: string[] | undefined) => (ids ?? []).map((i) => getIdea(db, i)).filter((x): x is Idea => !!x);
  const sIdeas = ideasOf(strategy?.body.ideaIds);
  const cIdeas = ideasOf(comments?.body.ideaIds);
  const backing = backingFor(db, [...sIdeas, ...cIdeas]);
  const synced = getSetting(db, "perf.youtube_synced_at");
  const missing = (["instagram", "facebook", "tiktok"] as const).filter((p) => !perf.summaries.some((s) => s.platform === p));

  return (
    <div className="mx-auto max-w-[1200px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-serif text-[28px] font-bold tracking-tight">Performance</h1>
          <p className="text-[13px] text-muted">Your own numbers on every platform, what works for you, what your audience says — and what to make next. These numbers also steer your ideas and scripts.</p>
        </div>
        <span className="flex items-center gap-2 text-[12px] text-muted">Everything: <SectionRefresh what="performance" updatedAt={synced || null} /> <SyncButton /></span>
      </header>

      {/* Platform tiles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {perf.summaries.map((s) => {
          const change = s.prevViews ? (s.recentViews - s.prevViews) / s.prevViews : null;
          return (
            <div key={s.platform} className="card overflow-hidden">
              <div className={`h-1.5 ${COLOR[s.platform]}`} />
              <div className="px-4 py-3">
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">{s.label}</span>
                  {s.followers != null && <span className="text-[12px] text-muted">{fmt(s.followers)} followers{s.followersChange ? ` (${s.followersChange > 0 ? "+" : ""}${fmt(s.followersChange)})` : ""}</span>}
                </div>
                <div className="mt-1 font-serif text-[26px] font-bold leading-none">{fmt(s.recentPosts ? s.recentViews : s.totalViews)}</div>
                <div className="text-[11.5px] text-muted">
                  {s.recentPosts ? (
                    <>
                      {s.metric} in the last 30 days · {s.recentPosts} post{s.recentPosts === 1 ? "" : "s"}
                      {change != null && <span className={change >= 0 ? "text-ok" : "text-bad"}> · {change >= 0 ? "+" : ""}{Math.round(change * 100)}% vs the 30 before</span>}
                    </>
                  ) : (
                    <>{s.metric} across all {s.posts} posts · <span className="text-warn">nothing posted in 30 days</span></>
                  )}
                </div>
                <div className="mt-2 text-[12px] text-ink-2">Typical post: <b>{fmt(s.typical)}</b> {s.metric} · {s.posts} posts tracked</div>
                {s.lastPostAt && <div className={`text-[11.5px] ${Date.now() - Date.parse(s.lastPostAt) > 14 * 86_400_000 ? "text-warn" : "text-muted"}`}>Last post {timeAgo(s.lastPostAt)}</div>}
              </div>
            </div>
          );
        })}
        {missing.map((p) => (
          <div key={p} className="card flex flex-col justify-center border-dashed px-4 py-3 text-[12.5px] text-muted">
            <span className="font-semibold text-ink-2">{LABEL[p]}</span>
            {p === "tiktok" ? "No numbers yet — import a TikTok export below." : "Not connected yet — see the direct connection below, or import an export."}
          </div>
        ))}
      </div>

      <MetaConnect />
      <ImportPanel open={false} />

      {/* Strategist */}
      <section className="card px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-serif text-[20px] font-semibold">Your strategist</h2>
            <p className="text-[12.5px] text-muted">An honest read of your numbers, comments and what&apos;s in the news: what to keep, what to stop, and a plan for the next 7 days. Run it weekly.</p>
          </div>
          <StrategyButton has={!!strategy} />
        </div>
        {strategy ? <Strategy r={strategy.body} at={strategy.createdAt} ideas={sIdeas} backing={backing} /> : <p className="mt-3 text-[12.5px] text-muted">No report yet.</p>}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card px-4 py-3">
          <h2 className="font-serif text-[18px] font-semibold">What works for you</h2>
          <p className="mb-2 text-[12px] text-muted">Each line compares posts with that trait to your typical post on that platform. Small numbers (n) are hints, not rules.</p>
          {perf.patterns.length ? <PatternList items={perf.patterns} /> : <p className="text-[12.5px] text-muted">Needs at least 6 posts older than 3 days on a platform.</p>}
        </section>
        <section className="card px-4 py-3">
          <h2 className="font-serif text-[18px] font-semibold">Best performers</h2>
          <p className="mb-2 text-[12px] text-muted">Against your typical post on the same platform.</p>
          <PostList posts={perf.top} />
          {perf.flops.length > 0 && (
            <>
              <h3 className="mb-1 mt-3 text-[12px] font-semibold uppercase tracking-wide text-muted">Fell short (last 4 months)</h3>
              <PostList posts={perf.flops} />
            </>
          )}
        </section>
      </div>

      <section className="card px-4 py-3">
        <h2 className="font-serif text-[18px] font-semibold">Latest posts</h2>
        <p className="mb-2 text-[12px] text-muted">How each one is doing against your usual. Posts under 3 days old are still growing.</p>
        <PostList posts={perf.latest} showAge />
      </section>

      {/* Audience */}
      <section className="card px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-serif text-[20px] font-semibold">What your audience says</h2>
            <p className="text-[12.5px] text-muted">{scan.count} YouTube comments collected. Instagram, Facebook and TikTok comments aren&apos;t in their exports.</p>
          </div>
          {scan.count >= 5 && <CommentsButton has={!!comments} />}
        </div>
        {comments && <CommentsView c={comments.body} at={comments.createdAt} ideas={cIdeas} backing={backing} />}
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <CommentList title="Asking you to cover" items={scan.requests} />
          <CommentList title="Questions" items={scan.questions} />
        </div>
      </section>
    </div>
  );
}

function PatternList({ items }: { items: Pattern[] }) {
  const max = Math.max(2, ...items.map((p) => p.lift));
  return (
    <ul className="space-y-1.5">
      {items.map((p, i) => (
        <li key={i} className="text-[12.5px]">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-ink-2"><span className="text-muted">{LABEL[p.platform as keyof typeof LABEL]} · </span>{p.label}</span>
            <span className={`shrink-0 font-semibold tabular-nums ${p.kind === "good" ? "text-ok" : "text-bad"}`}>{lx(p.lift)} <span className="font-normal text-muted">n={p.n}</span></span>
          </div>
          <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className={`h-full rounded-full ${p.kind === "good" ? "bg-ok" : "bg-bad"}`} style={{ width: `${Math.min(100, (p.lift / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function PostList({ posts, showAge }: { posts: RankedPost[]; showAge?: boolean }) {
  if (!posts.length) return <p className="text-[12.5px] text-muted">Nothing yet.</p>;
  return (
    <ul className="divide-y divide-line">
      {posts.map((p) => {
        const young = p.publishedAt && Date.now() - Date.parse(p.publishedAt) < 3 * 86_400_000;
        return (
          <li key={p.id} className="flex items-center gap-2.5 py-1.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${COLOR[p.platform]}`} title={LABEL[p.platform]} />
            <a href={p.url ?? undefined} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
              <span className="line-clamp-1 text-[13px] text-ink hover:underline">{p.title || "(no caption)"}</span>
              <span className="text-[11.5px] text-muted">
                {LABEL[p.platform]}{p.kind ? ` ${p.kind}` : ""} · {fmt(p.metric)} {p.views != null ? "views" : p.reach != null ? "reach" : "likes"}
                {p.likes != null ? ` · ${fmt(p.likes)} likes` : ""}{p.comments ? ` · ${fmt(p.comments)} comments` : ""}{p.saves ? ` · ${fmt(p.saves)} saves` : ""}{p.shares ? ` · ${fmt(p.shares)} shares` : ""}
                {showAge && p.publishedAt ? ` · ${timeAgo(p.publishedAt)}` : ""}
              </span>
            </a>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums ${young ? "bg-surface-2 text-muted" : p.lift >= 1.5 ? "bg-ok-soft text-ok" : p.lift < 0.7 ? "bg-bad-soft text-bad" : "bg-surface-2 text-ink-2"}`}>
              {lx(p.lift)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function CommentList({ title, items }: { title: string; items: { id: string; text: string; likes: number; video: string | null }[] }) {
  return (
    <div>
      <h3 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {items.length ? (
        <ul className="space-y-1.5">
          {items.map((c) => (
            <li key={c.id} className="text-[12.5px]">
              <span className="text-ink">“{c.text.length > 220 ? c.text.slice(0, 220) + "…" : c.text}”</span>
              <span className="text-[11px] text-muted"> {c.likes ? `${c.likes}♥ · ` : ""}{c.video ? `on “${c.video.slice(0, 50)}”` : ""}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12.5px] text-muted">None found yet.</p>
      )}
    </div>
  );
}

function IdeaRow({ ideas, backing }: { ideas: Idea[]; backing: ReturnType<typeof backingFor> }) {
  if (!ideas.length) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {ideas.map((i) => (
        <div key={i.id} className="space-y-1.5">
          <IdeaCard idea={i} backing={backing[i.id] ?? { stories: [], sources: [] }} compact />
          <IdeaQuickActions idea={i} />
        </div>
      ))}
    </div>
  );
}

const H = ({ children }: { children: React.ReactNode }) => <h3 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-muted">{children}</h3>;

function Strategy({ r, at, ideas, backing }: { r: StrategyReport; at: string; ideas: Idea[]; backing: ReturnType<typeof backingFor> }) {
  return (
    <div className="mt-3 space-y-4 text-[13px]">
      <p className="rounded-xl bg-accent-soft px-3 py-2 font-serif text-[15.5px] leading-snug text-ink">{r.verdict}</p>
      <p className="text-[11.5px] text-muted">Written {timeAgo(at)} from: {r.dataNote} posts.</p>
      {r.week.length > 0 && (
        <div>
          <H>Next 7 days</H>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <tbody>
                {r.week.map((w, i) => (
                  <tr key={i} className="border-b border-line align-top last:border-0">
                    <td className="whitespace-nowrap py-1.5 pr-3 font-semibold text-ink">{w.day}</td>
                    <td className="whitespace-nowrap py-1.5 pr-3 text-muted">{w.platform} · {w.format}</td>
                    <td className="py-1.5"><div className="font-medium text-ink">{w.idea}</div><div className="text-muted">Hook: {w.hook} — {w.why}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div><H>Working</H><ul className="space-y-1">{r.worked.map((w, i) => <li key={i}><span className="text-ok">✓</span> {w.point} <span className="text-muted">— {w.evidence}</span></li>)}</ul></div>
        <div><H>Not working</H><ul className="space-y-1">{r.didnt.map((w, i) => <li key={i}><span className="text-bad">✗</span> {w.point} <span className="text-muted">— {w.evidence}</span></li>)}</ul></div>
        <div><H>Do more of</H><ul className="list-disc space-y-0.5 pl-4">{r.double_down.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
        <div><H>Stop doing</H><ul className="list-disc space-y-0.5 pl-4">{r.stop.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
        <div><H>Titles, thumbnails & hooks</H><ul className="list-disc space-y-0.5 pl-4">{r.packaging.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
        <div><H>When to post</H><p>{r.timing}</p></div>
      </div>
      {r.per_platform.length > 0 && <div><H>By platform</H><ul className="space-y-1">{r.per_platform.map((p, i) => <li key={i}><b>{p.platform}:</b> {p.advice}</li>)}</ul></div>}
      {r.experiments.length > 0 && <div><H>Experiments to run</H><ul className="space-y-1">{r.experiments.map((e, i) => <li key={i}><b>{e.test}</b> — {e.how} <span className="text-muted">Measure: {e.measure}</span></li>)}</ul></div>}
      {ideas.length > 0 && <div><H>Ideas from this report (also in your Studio)</H><IdeaRow ideas={ideas} backing={backing} /></div>}
    </div>
  );
}

function CommentsView({ c, at, ideas, backing }: { c: CommentInsights; at: string; ideas: Idea[]; backing: ReturnType<typeof backingFor> }) {
  return (
    <div className="mt-3 space-y-3 text-[13px]">
      <p className="rounded-xl bg-accent-soft px-3 py-2 text-ink">{c.mood} <span className="text-[11.5px] text-muted">({c.commentCount} comments, {timeAgo(at)})</span></p>
      <div className="grid gap-4 md:grid-cols-2">
        {c.questions.length > 0 && <div><H>They keep asking</H><ul className="space-y-1">{c.questions.map((q, i) => <li key={i}>{q.question} <span className="text-muted">×{q.how_many} — “{q.example}”</span></li>)}</ul></div>}
        {c.requests.length > 0 && <div><H>They want you to cover</H><ul className="space-y-1">{c.requests.map((q, i) => <li key={i}>{q.topic} <span className="text-muted">×{q.how_many} — “{q.example}”</span></li>)}</ul></div>}
        {c.pushback.length > 0 && <div><H>Pushback</H><ul className="space-y-1">{c.pushback.map((p, i) => <li key={i}><span className={p.fair ? "text-warn" : "text-muted"}>{p.fair ? "Fair point" : "Not fair"}:</span> {p.point} <span className="text-muted">— {p.suggestion}</span></li>)}</ul></div>}
        {c.loved.length > 0 && <div><H>Loved</H><ul className="list-disc space-y-0.5 pl-4">{c.loved.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
      </div>
      {ideas.length > 0 && <div><H>Ideas your audience asked for (also in your Studio)</H><IdeaRow ideas={ideas} backing={backing} /></div>}
    </div>
  );
}
