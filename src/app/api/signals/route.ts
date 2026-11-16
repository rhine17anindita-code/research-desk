import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { nowIso } from "@/lib/ids";

export const POST = route(async (req: Request) => {
  const b = await body<{ label: string; description?: string; cues: string[] }>(req);
  if (!b.label?.trim() || !b.cues?.length) throw new Error("A signal needs a name and at least one cue phrase");
  const id = b.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) + "-" + Date.now().toString(36).slice(-4);
  getDb().prepare("INSERT INTO signals (id, label, description, cues, weight, learned, enabled, builtin, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 0, 1, 0, ?, ?)")
    .run(id, b.label.trim(), b.description?.trim() || b.label.trim(), JSON.stringify(b.cues.map((c) => c.trim()).filter(Boolean)), nowIso(), nowIso());
  return { ok: true, id };
});
