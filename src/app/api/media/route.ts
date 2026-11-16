import { route } from "@/lib/http";
import { searchArchive, searchCommons, searchYouTube, youtubeConfigured, youtubeSearchLink } from "@/lib/media";

/** Free visual/archival lookups for a query. No AI. */
export const GET = route(async (req: Request) => {
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") ?? "").trim().slice(0, 120);
  if (!q) throw new Error("Nothing to search for");
  const kinds = (u.searchParams.get("kinds") ?? "images,archive,video").split(",");
  const [images, archive, videos] = await Promise.all([
    kinds.includes("images") ? searchCommons(q).catch(() => []) : [],
    kinds.includes("archive") ? searchArchive(q).catch(() => []) : [],
    kinds.includes("video") ? searchYouTube(q).catch(() => []) : [],
  ]);
  return { ok: true, images, archive, videos, youtube: { configured: youtubeConfigured(), searchUrl: youtubeSearchLink(q) } };
});
