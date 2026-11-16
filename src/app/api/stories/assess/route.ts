import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { assessStories } from "@/lib/research/ai-tasks";

export const POST = route(async (req: Request) => {
  const b = await body<{ ids: string[]; estimateOnly?: boolean }>(req);
  return assessStories(getDb(), b.ids ?? [], { estimateOnly: b.estimateOnly });
});
