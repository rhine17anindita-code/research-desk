import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { activeChannelId, createChannel, listChannels, setActiveChannel } from "@/lib/channels";

export const GET = route(() => {
  const db = getDb();
  return { ok: true, channels: listChannels(db), active: activeChannelId(db) };
});

export const POST = route(async (req: Request) => {
  const b = await body<{ name: string; description?: string; template?: string; geo?: string }>(req);
  if (!b.name?.trim()) throw new Error("A channel needs a name");
  const db = getDb();
  const ch = createChannel(db, b);
  setActiveChannel(db, ch.id);
  return { ok: true, channel: ch };
});
