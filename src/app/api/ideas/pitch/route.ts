import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { savePitch } from "@/lib/ideation/pitch";

/** Save your own idea (free). Related stories in the channel are matched locally. */
export const POST = route(async (req: Request) => {
  const b = await body<{ text: string; format?: string; title?: string }>(req);
  if (!b.text?.trim()) throw new Error("Write your idea first");
  return { ok: true, idea: savePitch(getDb(), { text: b.text, format: b.format ?? "youtube-long", title: b.title }) };
});
