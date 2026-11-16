import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { createNote } from "@/lib/repo/projects";

export const POST = route(async (req: Request) => {
  const b = await body<{ projectId?: string; clusterId?: string; questionId?: string; title?: string; body: string; origin?: "user" | "assistant" }>(req);
  if (!b.body?.trim()) throw new Error("A note needs some text");
  return { ok: true, note: createNote(getDb(), b) };
});
