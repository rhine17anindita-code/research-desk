import { getDb } from "@/lib/db";
import { route } from "@/lib/http";
import { breakouts, checks, listCompetitors, listYtChannels, weeklyPlan, yppProgress } from "@/lib/youtube";

/** Everything the YouTube page shows for one channel (free; competitor numbers come from the YouTube API when refreshed). */
export const GET = route((req: Request) => {
  const db = getDb();
  const channels = listYtChannels(db);
  const id = new URL(req.url).searchParams.get("yt") ?? channels[0]?.id;
  const yt = channels.find((c) => c.id === id) ?? channels[0];
  const suggestions = (db.prepare("SELECT name, url FROM feeds WHERE category = 'reference' AND url LIKE '%channel_id=%'").all() as { name: string; url: string }[]).map((f) => ({
    name: f.name.replace(/ \(YouTube\)$/, ""), id: f.url.match(/channel_id=(UC[\w-]+)/)?.[1] ?? "",
  }));
  return {
    ok: true, channels, selected: yt?.id ?? null,
    progress: yt ? yppProgress(db, yt) : null,
    plan: weeklyPlan(20),
    competitors: yt ? listCompetitors(db, yt.id) : [],
    breakouts: yt ? breakouts(db, yt.id) : [],
    launchChecks: yt ? checks(db, `launch:${yt.id}`) : [],
    setChecks: checks(db, "set"),
    suggestions,
    // Videos in production for this channel, newest first.
    productions: yt
      ? (db.prepare("SELECT id, title, production_stage AS stage, publish_date AS publishDate, updated_at AS updatedAt, production FROM projects WHERE json_extract(production, '$.yt_channel') = ? AND stage != 'archived' ORDER BY updated_at DESC LIMIT 30").all(yt.id) as { id: string; title: string; stage: string; publishDate: string | null; updatedAt: string; production: string }[])
          .map(({ production, ...r }) => {
            const d = JSON.parse(production || "{}") as Record<string, string>;
            return { ...r, steps: { brief: !!d.yt_brief, research: !!d.dossier, outline: !!d.outline, script: !!d.script, package: !!d.captions } };
          })
      : [],
  };
});
