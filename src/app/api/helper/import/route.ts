import { getDb } from "@/lib/db";
import { body, json, route } from "@/lib/http";
import { verifyHelper } from "@/lib/helper-auth";

export const maxDuration = 120;

type Row = Record<string, unknown>;
const TABLES = ["ideas", "inspirations", "voice_sources", "voice_profiles", "projects", "sources", "project_items"] as const;

/**
 * One-time move of work from the Mac to the live site (sent by the helper with --push-local).
 * Copies rows by id and never overwrites anything already here, so it's safe to run twice.
 */
export const POST = route(async (req: Request) => {
  if (!verifyHelper(req)) return json({ ok: false, message: "Not signed by the helper" }, 401);
  const b = await body<Partial<Record<(typeof TABLES)[number], Row[]>>>(req);
  const db = getDb();
  const cols = (t: string) => new Set((db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name));
  const counts: Record<string, number> = {};
  const sourceId = new Map<string, string>();
  const insert = (t: string, r: Row) => {
    const have = cols(t);
    const keys = Object.keys(r).filter((k) => have.has(k));
    if (!keys.length) return false;
    return db.prepare(`INSERT OR IGNORE INTO ${t} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`).run(...keys.map((k) => r[k] as never)).changes > 0;
  };
  db.transaction(() => {
    // Sources first: one with the same link already here is reused instead.
    for (const s of b.sources ?? []) {
      const existing = s.url ? (db.prepare("SELECT id FROM sources WHERE url = ?").get(s.url) as { id: string } | undefined) : undefined;
      if (existing) sourceId.set(String(s.id), existing.id);
      else if (insert("sources", { ...s, article_id: null })) { sourceId.set(String(s.id), String(s.id)); counts.sources = (counts.sources ?? 0) + 1; }
    }
    for (const t of ["ideas", "inspirations", "voice_sources", "voice_profiles", "projects"] as const) {
      for (const r of b[t] ?? []) {
        const row = t === "ideas" ? { ...r, project_id: null } : r;
        if (insert(t, row)) counts[t] = (counts[t] ?? 0) + 1;
      }
    }
    // Project links to sources (story links can't move: the live site has its own stories).
    for (const it of b.project_items ?? []) {
      if (it.item_type !== "source") continue;
      const sid = sourceId.get(String(it.item_id));
      if (sid && insert("project_items", { ...it, item_id: sid })) counts.project_items = (counts.project_items ?? 0) + 1;
    }
  })();
  return { ok: true, counts };
});
