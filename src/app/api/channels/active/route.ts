import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { setActiveChannel } from "@/lib/channels";

export const POST = route(async (req: Request) => {
  const b = await body<{ id: string }>(req);
  setActiveChannel(getDb(), b.id);
  return { ok: true };
});
