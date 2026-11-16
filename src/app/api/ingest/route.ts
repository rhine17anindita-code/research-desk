import { getDb } from "@/lib/db";
import { ingestFeeds } from "@/lib/ingest/pipeline";
import { body, route } from "@/lib/http";

export const POST = route(async (req: Request) => {
  const b = await body<{ feedIds?: string[] }>(req);
  const result = await ingestFeeds(getDb(), { feedIds: b.feedIds, trigger: "manual" });
  return { ok: true, result };
});
