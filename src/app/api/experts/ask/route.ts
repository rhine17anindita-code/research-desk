import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { askExpert } from "@/lib/experts";

export const maxDuration = 120;

/** Optional AI: read one expert item and answer a question about it (cheap model; the answer is kept). */
export const POST = route(async (req: Request) => {
  const b = await body<{ id: string; question?: string; estimateOnly?: boolean }>(req);
  return askExpert(getDb(), b.id, { question: b.question, estimateOnly: b.estimateOnly });
});
