import { getDb } from "@/lib/db";
import { body, json, route } from "@/lib/http";
import { verifyHelper } from "@/lib/helper-auth";
import { setVoiceSourceText } from "@/lib/voice";
import { nowIso } from "@/lib/ids";
import { truncate } from "@/lib/text";

/** The Mac helper hands over a video's transcript (made from its audio on the Mac). */
export const POST = route(async (req: Request) => {
  if (!verifyHelper(req)) return json({ ok: false, message: "Not signed by the helper" }, 401);
  const b = await body<{ type: "voice" | "research"; id: string; status: "ok" | "failed"; text?: string; error?: string }>(req);
  const db = getDb();
  const text = b.text?.trim().slice(0, 60000);
  if (b.type === "voice") setVoiceSourceText(db, b.id, b.status === "ok" && text ? { status: "ready", text } : { status: "failed", error: b.error?.slice(0, 300) ?? "Couldn't transcribe this video" });
  else if (b.type === "research") {
    const r = db.prepare("SELECT source_id FROM research_items WHERE id = ?").get(b.id) as { source_id: string | null } | undefined;
    if (r && b.status === "ok" && text) {
      db.prepare("UPDATE research_items SET body = ?, status = 'ready', error = NULL, media_status = 'done', updated_at = ? WHERE id = ?").run(text, nowIso(), b.id);
      if (r.source_id) db.prepare("UPDATE sources SET excerpt = ?, updated_at = ? WHERE id = ?").run(truncate(text, 20000), nowIso(), r.source_id);
    } else if (r) db.prepare("UPDATE research_items SET media_status = 'failed', error = ?, updated_at = ? WHERE id = ?").run(b.error?.slice(0, 300) ?? "Couldn't transcribe this video", nowIso(), b.id);
  }
  return { ok: true };
});
