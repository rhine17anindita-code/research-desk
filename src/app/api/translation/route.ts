import { getDb } from "@/lib/db";
import { route } from "@/lib/http";
import { getTranslation, type TKind } from "@/lib/translate";

/** English translation of a Bangla item, if your Mac has made it yet. */
export const GET = route((req: Request) => {
  const u = new URL(req.url);
  const parts = getTranslation(getDb(), (u.searchParams.get("kind") ?? "article") as TKind, u.searchParams.get("id") ?? "");
  return { ok: true, ready: !!parts, parts: parts ?? [] };
});
