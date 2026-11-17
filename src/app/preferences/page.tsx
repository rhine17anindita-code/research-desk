import { getDb } from "@/lib/db";
import { activeChannel } from "@/lib/channels";
import { getPrefs } from "@/lib/prefs";
import { PreferencesPanel } from "@/components/PreferencesPanel";

export const dynamic = "force-dynamic";

export default function PreferencesPage() {
  const db = getDb();
  const ch = activeChannel(db);
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 lg:px-8">
      <PreferencesPanel channel={ch.name} channelId={ch.id} initial={getPrefs(db)} newsRatio={ch.newsRatio} />
    </div>
  );
}
