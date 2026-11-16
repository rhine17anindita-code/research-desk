import { getDb } from "@/lib/db";
import { listInspirations } from "@/lib/ideation/repo";
import { AddInspiration, InspirationItem } from "@/components/ideas/InspirationInbox";

export const dynamic = "force-dynamic";

export default function InspirationPage() {
  const db = getDb();
  const items = listInspirations(db);
  const st = db.prepare("SELECT id, headline FROM clusters WHERE id = ?");
  return (
    <>
    <h1 className="mb-4 font-serif text-[26px] font-semibold tracking-tight">Inspiration</h1>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-w-0">
        {items.length === 0 ? (
          <div className="card px-6 py-8 text-center text-[13.5px] text-muted">
            Your inspiration inbox is empty. Save videos, reels, posts, papers or plain ideas that excite you — the system learns your style from them and builds ideas around them.
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((i) => (
              <InspirationItem
                key={i.id}
                item={i}
                stories={i.matchedClusters.map((id) => st.get(id) as { id: string; headline: string } | undefined).filter((x): x is { id: string; headline: string } => !!x).slice(0, 4)}
              />
            ))}
          </ul>
        )}
      </section>
      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <AddInspiration />
        <p className="text-[12px] leading-relaxed text-muted">
          The app reads only what a link shares publicly (title, channel, description). It can&apos;t watch videos or reels, so for those your note matters most. Instagram often shares nothing without a login.
        </p>
      </aside>
    </div>
    </>
  );
}
