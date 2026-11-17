import { getDb } from "@/lib/db";
import { talkEpisodes, talkShows } from "@/lib/ideation/talk";
import { activeChannel } from "@/lib/channels";
import { TalkShowSwitches } from "@/components/studio/TalkShowSwitches";
import { TalkSection } from "@/components/studio/SideSections";

export const dynamic = "force-dynamic";

export default async function TalkPage() {
  const db = getDb();
  const lastTalk = (db.prepare("SELECT MAX(a.fetched_at) AS t FROM articles a JOIN feeds f ON f.id = a.feed_id WHERE f.category = 'talk'").get() as { t: string | null }).t;
  const [bn, en] = await Promise.all([talkEpisodes(db, { language: "bn", limit: 60, days: 7 }), talkEpisodes(db, { language: "en", limit: 60, days: 7 })]);
  return (
    <div className="mx-auto max-w-[1100px] space-y-4 px-4 py-6 sm:px-6">
      <TalkShowSwitches initial={talkShows(db)} channel={activeChannel(db).name} />
      <TalkSection bn={bn} en={en} full updatedAt={lastTalk} />
    </div>
  );
}
