import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { deleteYtChannel, saveYtChannel, type YtChannel } from "@/lib/youtube";

export const POST = route(async (req: Request) => {
  const b = await body<{ id?: string; data: Partial<YtChannel> }>(req);
  return { ok: true, channel: saveYtChannel(getDb(), b.id ?? null, b.data ?? {}) };
});
export const DELETE = route(async (req: Request) => {
  const b = await body<{ id: string }>(req);
  deleteYtChannel(getDb(), b.id);
  return { ok: true };
});
