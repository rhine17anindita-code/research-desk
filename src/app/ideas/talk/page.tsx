import { getDb } from "@/lib/db";
import { talkEpisodes } from "@/lib/ideation/talk";
import { TalkSection } from "@/components/studio/SideSections";

export const dynamic = "force-dynamic";

export default async function TalkPage() {
  const db = getDb();
  const [bn, en] = await Promise.all([talkEpisodes(db, { language: "bn", limit: 40, days: 14 }), talkEpisodes(db, { language: "en", limit: 40, days: 14 })]);
  return (
    <div className="mx-auto max-w-[1100px]">
      <TalkSection bn={bn} en={en} full />
    </div>
  );
}
