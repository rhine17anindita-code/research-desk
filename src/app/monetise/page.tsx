import { getDb } from "@/lib/db";
import { activeChannel, activeChannelId } from "@/lib/channels";
import { MonetiseApp } from "@/components/monetise/MonetiseApp";

export const dynamic = "force-dynamic";

export default async function MonetisePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const db = getDb();
  const projects = db.prepare("SELECT id, title FROM projects WHERE (channel_id = ? OR channel_id IS NULL) AND stage != 'archived' ORDER BY updated_at DESC LIMIT 100").all(activeChannelId(db)) as { id: string; title: string }[];
  const tab = ["plan", "playbook", "sponsors", "series", "proposals"].includes(sp.tab ?? "") ? (sp.tab as "plan") : "plan";
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
      <MonetiseApp channel={activeChannel(db).name} initialTab={tab} projects={projects} />
    </div>
  );
}
