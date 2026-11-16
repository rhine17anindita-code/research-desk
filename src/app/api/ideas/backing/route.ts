import { getDb } from "@/lib/db";
import { route } from "@/lib/http";
import { getIdea, type Idea } from "@/lib/ideation/repo";
import { backingFor } from "@/lib/ideation/backing";

export const GET = route((req: Request) => {
  const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, 30);
  const db = getDb();
  const ideas = ids.map((id) => getIdea(db, id)).filter((x): x is Idea => !!x);
  return { ok: true, backing: backingFor(db, ideas) };
});
