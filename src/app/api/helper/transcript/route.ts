import { getDb } from "@/lib/db";
import { body, json, route } from "@/lib/http";
import { verifyHelper } from "@/lib/helper-auth";
import { storeTranscript, windows, clock, type Segment } from "@/lib/transcripts";
import { nowIso } from "@/lib/ids";
import { truncate } from "@/lib/text";

/** The Mac helper hands over a transcript (or says there isn't one). */
export const POST = route(async (req: Request) => {
  if (!verifyHelper(req)) return json({ ok: false, message: "Not signed by the helper" }, 401);
  const b = await body<{ videoId: string; articleId?: string | null; status: "ok" | "none" | "error"; language?: string; kind?: string; segments?: Segment[]; error?: string }>(req);
  if (!/^[\w-]{11}$/.test(b.videoId ?? "")) throw new Error("Bad video id");
  const segments = (b.segments ?? []).filter((s) => typeof s.t === "number" && typeof s.text === "string").slice(0, 20000);
  const db = getDb();
  storeTranscript(db, b.videoId, b.articleId ?? null, { status: b.status === "ok" && segments.length ? "ok" : b.status === "error" ? "error" : "none", language: b.language, kind: b.kind, segments, error: b.error?.slice(0, 300) });
  // A YouTube link in My research that was waiting for this transcript gets its full text now.
  if (segments.length) {
    const text = windows(segments).map((w) => `[${clock(w.start)}] ${w.text}`).join("\n");
    const items = db.prepare("SELECT id, source_id FROM research_items WHERE url LIKE ? AND status = 'thin'").all(`%${b.videoId}%`) as { id: string; source_id: string | null }[];
    for (const it of items) {
      db.prepare("UPDATE research_items SET body = ?, status = 'ready', error = NULL, updated_at = ? WHERE id = ?").run(text, nowIso(), it.id);
      if (it.source_id) db.prepare("UPDATE sources SET excerpt = ?, updated_at = ? WHERE id = ?").run(truncate(text, 20000), nowIso(), it.source_id);
    }
  }
  return { ok: true };
});
