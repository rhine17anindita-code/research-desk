import { getDb } from "@/lib/db";
import { activeChannel } from "@/lib/channels";
import { getProfile, listVoiceSources } from "@/lib/voice";
import { VoiceLab } from "@/components/voice/VoiceLab";

export const dynamic = "force-dynamic";

export default function VoicePage() {
  const db = getDb();
  const sources = listVoiceSources(db).map(({ text, ...s }) => ({ ...s, preview: text?.slice(0, 400) ?? null }));
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
      <VoiceLab channel={activeChannel(db).name} profile={getProfile(db)} sources={sources} />
    </div>
  );
}
