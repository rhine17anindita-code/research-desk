import type { DB } from "../db";
import { getSources } from "../repo/sources";
import type { Idea } from "./repo";

/** Resolve the story/source ids an idea cites into display info. */
export function backingFor(db: DB, ideas: Idea[]) {
  const out: Record<string, { stories: { id: string; headline: string; sourceCount: number }[]; sources: { id: string; title: string; publisher: string | null; url: string | null }[] }> = {};
  const st = db.prepare("SELECT id, headline, source_count FROM clusters WHERE id = ?");
  for (const i of ideas) {
    out[i.id] = {
      stories: i.backing.clusters
        .map((id) => st.get(id) as { id: string; headline: string; source_count: number } | undefined)
        .filter((x): x is { id: string; headline: string; source_count: number } => !!x)
        .map((x) => ({ id: x.id, headline: x.headline, sourceCount: x.source_count })),
      sources: getSources(db, i.backing.sources).map((s) => ({ id: s.id, title: s.title, publisher: s.publisher, url: s.url })),
    };
  }
  return out;
}
