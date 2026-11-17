import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { ingestFeeds } from "@/lib/ingest/pipeline";
import { activeChannel } from "@/lib/channels";
import { getPulse } from "@/lib/ideation/pulse";
import { clearMediaCaches } from "@/lib/media";
import { syncYoutube } from "@/lib/performance/youtube-sync";
import { metaConfigured, syncMeta } from "@/lib/performance/meta";

export const maxDuration = 180;

/** Refresh one part of the desk right now: news, talk shows, creators' videos, trends, or your own numbers. Free. */
export const POST = route(async (req: Request) => {
  const { what } = await body<{ what: "news" | "talk" | "creators" | "pulse" | "performance" }>(req);
  const db = getDb();
  if (what === "talk") {
    const ids = (db.prepare("SELECT id FROM feeds WHERE category = 'talk' AND enabled = 1").all() as { id: string }[]).map((r) => r.id);
    const r = await ingestFeeds(db, { feedIds: ids, trigger: "manual" });
    return { ok: true, message: `${r.articlesNew} new episode${r.articlesNew === 1 ? "" : "s"}` };
  }
  if (what === "creators") {
    clearMediaCaches();
    const ids = (db.prepare("SELECT id FROM feeds WHERE category = 'reference' AND enabled = 1").all() as { id: string }[]).map((r) => r.id);
    if (ids.length) await ingestFeeds(db, { feedIds: ids, trigger: "manual" });
    return { ok: true, message: "Creators' latest videos reloaded" };
  }
  if (what === "pulse") {
    await getPulse(db, activeChannel(db).geo, true);
    return { ok: true, message: "Trends reloaded" };
  }
  if (what === "performance") {
    clearMediaCaches();
    const yt = await syncYoutube(db).catch(() => null);
    const meta = metaConfigured() ? await syncMeta(db).catch(() => null) : null;
    return { ok: true, message: [yt ? `${yt.videos} YouTube videos` : "", meta ? `${meta.instagram} Instagram, ${meta.facebook} Facebook posts` : ""].filter(Boolean).join(" · ") || "Nothing to sync for this channel" };
  }
  const r = await ingestFeeds(db, { trigger: "manual" });
  const { fetchFullText } = await import("@/lib/ingest/fulltext");
  await fetchFullText(db, 30).catch(() => null);
  return { ok: true, message: `${r.articlesNew} new item${r.articlesNew === 1 ? "" : "s"}, ${r.clustersNew} new stor${r.clustersNew === 1 ? "y" : "ies"}` };
});
