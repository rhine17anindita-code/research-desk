import Link from "next/link";
import { getDb } from "@/lib/db";
import { activeChannel } from "@/lib/channels";
import { listIdeas, listInspirations } from "@/lib/ideation/repo";
import { backingFor } from "@/lib/ideation/backing";
import { findOpportunities } from "@/lib/ideation/opportunities";
import { findStatements } from "@/lib/ideation/statements";
import { cachedPulse } from "@/lib/ideation/pulse";
import { getAiStatus } from "@/lib/ai/service";
import { IdeaGrid } from "@/components/studio/IdeaGrid";
import { GeneratePanel } from "@/components/ideas/GeneratePanel";
import { Composer } from "@/components/studio/Composer";
import { Pipeline } from "@/components/studio/Pipeline";
import { DailyTrigger } from "@/components/studio/DailyTrigger";
import { CreatorsSection, TalkSection, YourChannelSection, InspirationSection, PulseSection, StatementsSection, UntoldSection } from "@/components/studio/SideSections";
import { referenceVideos } from "@/lib/ideation/creators";
import { youtubeConfigured } from "@/lib/media";
import { ownYoutube } from "@/lib/ideation/own";
import { talkEpisodes } from "@/lib/ideation/talk";
import { topUpEvergreen } from "@/lib/ideation/evergreen";
import { storiesToBuild } from "@/lib/ideation/build-stories";
import { AutoRefresh, StoriesToBuild } from "@/components/studio/StoriesToBuild";

export const dynamic = "force-dynamic";

/**
 * The Studio: one page from spark to project. Bring anything in at the top, browse
 * ideas in the middle, pull from statements / untold stories / trends / inspiration
 * on the side, and keep everything you like in the pipeline below.
 */
export default async function StudioPage() {
  const db = getDb();
  const ch = activeChannel(db);
  const score = (i: { packaging: { scores: { hook: number; massAppeal: number; novelty: number } } | null }) =>
    i.packaging ? i.packaging.scores.hook + i.packaging.scores.massAppeal + i.packaging.scores.novelty : 0;
  topUpEvergreen(db); // free evergreen ideas, so the grid is never empty
  const lastIngest = (db.prepare("SELECT MAX(started_at) AS t FROM ingest_runs").get() as { t: string | null }).t;
  const stale = !lastIngest || Date.now() - Date.parse(lastIngest) > 60 * 60_000;
  const deck = listIdeas(db, { status: "new", limit: 60 }).sort((a, b) => score(b) - score(a));
  const backing = backingFor(db, deck);
  const pulse = cachedPulse(db, ch.geo);
  // Fresh AI ideas twice a day (only when switched on for this channel; budgets still apply).
  const needsDaily = ch.dailyIdeas && (!ch.lastDailyAt || Date.now() - Date.parse(ch.lastDailyAt) > 12 * 3_600_000) && getAiStatus(db).available;

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-serif text-[30px] font-bold tracking-tight">
            {new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening"} — <span className="text-accent">what are we making?</span>
          </h1>
          <p className="text-[13px] text-muted">
            {ch.name} — find it, shape it, research it, script it.{" "}
            {!ch.profile.trim() && (
              <Link href="/settings?tab=channels" className="text-warn underline">Describe this channel&apos;s audience and style</Link>
            )}
          </p>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <Composer />
          {stale && <AutoRefresh />}
          {needsDaily && <DailyTrigger />}

          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="font-serif text-[20px] font-semibold">Ideas for you</h2>
              <span className="text-[12px] text-muted">{deck.length} waiting</span>
            </div>
            {deck.length ? (
              <IdeaGrid initial={deck} backing={backing} />
            ) : (
              <div className="card px-6 py-6 text-center">
                <p className="font-serif text-[18px] font-semibold">Start strong</p>
                <p className="mx-auto mt-1 max-w-lg text-[13px] text-muted">
                  Ideas are built from what people are searching and reading right now, this channel&apos;s untold stories, statements, history and your inspiration — packaged with titles, thumbnail and first seconds. {ch.dailyIdeas ? "" : "Switch on daily ideas in Settings → Channels to wake up to a fresh batch."}
                </p>
              </div>
            )}
            <div className="mt-4"><GeneratePanel compact /></div>
          </section>

          <StoriesToBuild stories={storiesToBuild(db, 6)} />

          <Pipeline
            mine={listIdeas(db, { origin: "user", status: ["saved", "developing", "made", "new"], limit: 50 })}
            saved={listIdeas(db, { status: "saved", limit: 50 }).filter((i) => i.origin === "ai")}
            developing={listIdeas(db, { status: "developing", limit: 50 })}
            made={listIdeas(db, { status: "made", limit: 50 })}
          />
        </div>

        <aside className="space-y-4">
          <YourChannelSection yt={await ownYoutube(db)} links={ch.links} />
          <StatementsSection statements={findStatements(db, { limit: 10 })} />
          <UntoldSection opps={findOpportunities(db, { limit: 8 })} />
          <TalkSection bn={await talkEpisodes(db, { language: "bn", limit: 8 })} en={await talkEpisodes(db, { language: "en", limit: 8 })} />
          <CreatorsSection videos={await referenceVideos(db, 8)} hasKey={youtubeConfigured()} />
          <PulseSection trends={pulse?.trends ?? []} mostRead={pulse?.mostRead ?? []} onThisDay={pulse?.onThisDay ?? []} geo={ch.geo} />
          <InspirationSection items={listInspirations(db, 10)} />
          <Link href="/ideas/taste" className="block text-center text-[12.5px] text-accent hover:underline">What it has learned about this channel →</Link>
        </aside>
      </div>
    </div>
  );
}
