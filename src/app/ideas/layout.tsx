import { getDb } from "@/lib/db";
import { ideaCounts } from "@/lib/ideation/repo";
import { IdeasTabs } from "@/components/ideas/IdeasTabs";

export const dynamic = "force-dynamic";

export default function IdeasLayout({ children }: { children: React.ReactNode }) {
  const db = getDb();
  const counts = ideaCounts(db);
  const insp = (db.prepare("SELECT COUNT(*) AS n FROM inspirations").get() as { n: number }).n;
  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-4">
        <h1 className="font-serif text-[28px] font-semibold tracking-tight">Ideas</h1>
        <p className="text-[13px] text-muted">Untold angles turned into content you can make — backed by your research, shaped by what you like.</p>
      </header>
      <IdeasTabs counts={{ browse: counts.new ?? 0, saved: (counts.saved ?? 0) + (counts.developing ?? 0) + (counts.made ?? 0), inspiration: insp }} />
      {children}
    </div>
  );
}
