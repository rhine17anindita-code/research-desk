import { getDb } from "@/lib/db";
import { route } from "@/lib/http";
import { searchAll } from "@/lib/repo/search";
import type { SearchKind } from "@/lib/repo/search-index";

export const GET = route((req: Request) => {
  const u = new URL(req.url);
  const kinds = (u.searchParams.get("kinds") ?? "").split(",").filter(Boolean) as SearchKind[];
  return { ok: true, hits: searchAll(getDb(), u.searchParams.get("q") ?? "", { kinds, limit: Number(u.searchParams.get("limit") ?? 30) }) };
});
