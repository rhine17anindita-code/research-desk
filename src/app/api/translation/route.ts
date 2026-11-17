import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { getTranslation, translateWithAi, type TKind } from "@/lib/translate";

export const maxDuration = 180;
const KINDS: TKind[] = ["transcript", "article", "research", "voice"];

/** English translation of a Bangla item, if it has been made yet. */
export const GET = route((req: Request) => {
  const u = new URL(req.url);
  const parts = getTranslation(getDb(), (u.searchParams.get("kind") ?? "article") as TKind, u.searchParams.get("id") ?? "");
  return { ok: true, ready: !!parts, parts: parts ?? [] };
});

/** Translate it now with the cheapest AI model (cost shown first). */
export const POST = route(async (req: Request) => {
  const b = await body<{ kind: TKind; id: string; estimateOnly?: boolean }>(req);
  if (!KINDS.includes(b.kind) || !b.id) throw new Error("What should be translated?");
  return translateWithAi(getDb(), b.kind, b.id, { estimateOnly: b.estimateOnly });
});
