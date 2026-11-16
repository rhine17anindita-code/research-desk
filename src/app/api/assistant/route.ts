import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { assistantTurn, threadFor } from "@/lib/research/assistant";
import { clearThread } from "@/lib/repo/chat";

export const GET = route((req: Request) => {
  const u = new URL(req.url);
  return { ok: true, ...threadFor(getDb(), u.searchParams.get("contextType") ?? "", u.searchParams.get("contextId") ?? "") };
});
export const POST = route(async (req: Request) => {
  const b = await body<{ contextType: string; contextId: string; message: string; retrieve?: boolean; estimateOnly?: boolean }>(req);
  if (!b.message?.trim()) throw new Error("Type a message");
  return assistantTurn(getDb(), b);
});
export const DELETE = route(async (req: Request) => {
  const b = await body<{ threadId: string }>(req);
  clearThread(getDb(), b.threadId);
  return { ok: true };
});
