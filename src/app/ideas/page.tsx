import Link from "next/link";
import { getDb } from "@/lib/db";
import { listIdeas } from "@/lib/ideation/repo";
import { backingFor } from "@/lib/ideation/backing";
import { findOpportunities } from "@/lib/ideation/opportunities";
import { IdeaDeck } from "@/components/ideas/IdeaDeck";
import { GeneratePanel } from "@/components/ideas/GeneratePanel";
import { getSetting } from "@/lib/repo/settings";

export const dynamic = "force-dynamic";

export default function IdeasBrowsePage() {
  const db = getDb();
  // Oldest unseen first, so a batch is browsed in the order it was made.
  const ideas = listIdeas(db, { status: "new", limit: 100 }).reverse();
  const backing = backingFor(db, ideas);
  const opps = findOpportunities(db, { limit: 5 });
  const hasProfile = !!getSetting(db, "profile.about").trim();

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="min-w-0">
        {ideas.length ? (
          <IdeaDeck initial={ideas} backing={backing} />
        ) : (
          <div className="card px-6 py-8 text-center">
            <h2 className="font-serif text-[20px] font-semibold">No ideas to browse yet</h2>
            <p className="mx-auto mt-1 max-w-lg text-[13.5px] text-muted">
              The AI reads the stories with the most untold potential in your database, your inspirations and your taste, and proposes content ideas for different platforms — each one backed by the research behind it.
            </p>
          </div>
        )}
        <div className="mt-5">
          <GeneratePanel />
        </div>
      </section>
      <aside className="space-y-4">
        {!hasProfile && (
          <div className="rounded-lg border border-warn/30 bg-warn-soft px-4 py-3 text-[13px] text-warn">
            Tip: fill in your <Link href="/settings?tab=personalisation" className="underline">research profile</Link> (who you are, your audience and formats). Ideas get much more relevant.
          </div>
        )}
        <div className="card p-4">
          <div className="eyebrow mb-2">Most untold right now</div>
          <ul className="space-y-2.5">
            {opps.map((o) => (
              <li key={o.clusterId}>
                <Link href={`/story/${o.clusterId}`} className="text-[13px] font-medium leading-snug text-ink hover:underline">{o.headline}</Link>
                <div className="text-[11.5px] leading-snug text-muted">{o.reasons[0]}</div>
              </li>
            ))}
          </ul>
          <Link href="/ideas/untold" className="mt-3 block text-[12.5px] text-accent hover:underline">See all untold stories →</Link>
        </div>
        <div className="card p-4 text-[12.5px] leading-relaxed text-muted">
          <div className="eyebrow mb-1.5">How it learns</div>
          Every skip, save and develop — and the reasons you tap — is recorded on this machine. New batches use it straight away. Open <Link href="/ideas/taste" className="text-accent hover:underline">What it&apos;s learned</Link> to see the patterns and update your taste summary.
        </div>
      </aside>
    </div>
  );
}
