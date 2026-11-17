import { body, route } from "@/lib/http";
import { checkTitle, searchSuggestions } from "@/lib/youtube";

/** Title checks (rules) and what people search on YouTube for the topic (YouTube's free suggestions). */
export const POST = route(async (req: Request) => {
  const b = await body<{ title?: string; topic?: string }>(req);
  return { ok: true, ...(b.title ? checkTitle(b.title) : { checks: [], score: 0 }), suggestions: b.topic?.trim() ? await searchSuggestions(b.topic.trim()) : [] };
});
