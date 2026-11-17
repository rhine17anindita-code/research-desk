import { getDb } from "@/lib/db";
import { listResearch, viewResearch } from "@/lib/research-inbox";
import { ResearchAdd, ResearchCard } from "@/components/research/ResearchInbox";
import { ShareHelp } from "@/components/research/ShareHelp";

export const dynamic = "force-dynamic";

/** My research: everything the creator found themselves, ready to turn into angles, ideas and projects. */
export default async function InboxPage({ searchParams }: { searchParams: Promise<{ url?: string; text?: string; title?: string }> }) {
  const sp = await searchParams;
  const db = getDb();
  const items = listResearch(db, 80).map((r) => viewResearch(db, r));
  // Shared from a phone or the browser button: a link sometimes arrives inside "text".
  const linkInText = sp.text?.match(/https?:\/\/\S+/)?.[0];
  const prefill = sp.url || sp.text || sp.title ? { url: sp.url || linkInText, text: sp.url || linkInText ? undefined : sp.text, title: sp.title } : undefined;
  return (
    <div className="mx-auto max-w-[1000px] space-y-5 px-4 py-6 sm:px-6">
      <header>
        <h1 className="font-serif text-[28px] font-bold tracking-tight">My research</h1>
        <p className="text-[13px] text-muted">
          News you read, things you saw on TV, posts, documents. Add it here and it becomes a source: get angles and ideas from it, or make it a project with research and a script. Adding is free.
        </p>
      </header>
      <ResearchAdd prefill={prefill} />
      <ShareHelp />
      <div className="space-y-3">
        {items.map((i) => <ResearchCard key={i.id} item={i} />)}
        {!items.length && <p className="text-center text-[13px] text-muted">Nothing here yet. Add the first thing you read today.</p>}
      </div>
    </div>
  );
}
