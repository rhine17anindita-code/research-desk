import type { DB } from "../db";
import { activeChannel, getChannel, updateChannel } from "../channels";
import { ownChannelStats, resolveYoutubeChannel, type OwnChannel } from "../media";

/** The active channel's own YouTube numbers, resolving and remembering the channel id on first use. */
export async function ownYoutube(db: DB, channelId?: string): Promise<OwnChannel | null> {
  const ch = (channelId && getChannel(db, channelId)) || activeChannel(db);
  let id = ch.youtubeChannelId;
  try {
    if (!id && ch.links.youtube) {
      id = await resolveYoutubeChannel(ch.links.youtube);
      if (id) updateChannel(db, ch.id, { youtubeChannelId: id });
    }
    return id ? await ownChannelStats(id) : null;
  } catch {
    return null; // no key, quota or network: the card just hides
  }
}
