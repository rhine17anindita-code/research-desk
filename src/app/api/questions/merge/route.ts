import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { mergeQuestions } from "@/lib/repo/questions";

export const POST = route(async (req: Request) => {
  const b = await body<{ ids: string[]; text: string }>(req);
  if (!b.ids || b.ids.length < 2) throw new Error("Select at least two questions to combine");
  if (!b.text?.trim()) throw new Error("The combined question needs text");
  return { ok: true, question: mergeQuestions(getDb(), b.ids, b.text) };
});
