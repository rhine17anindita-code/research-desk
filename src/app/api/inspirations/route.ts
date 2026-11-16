import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { createInspiration, listInspirations, type InspirationIntent } from "@/lib/ideation/repo";
import { detectKind, fetchLinkMeta, matchStories } from "@/lib/ideation/metadata";

export const GET = route(() => ({ ok: true, inspirations: listInspirations(getDb()) }));

/** Save a link or note as inspiration. Public metadata is fetched; related stories are matched locally. No AI. */
export const POST = route(async (req: Request) => {
  const b = await body<{ url?: string; note?: string; title?: string; intents?: InspirationIntent[] }>(req);
  const url = b.url?.trim() || null;
  if (!url && !b.note?.trim() && !b.title?.trim()) throw new Error("Paste a link or write a note");
  if (url && !/^https?:\/\//i.test(url)) throw new Error("Links must start with http:// or https://");
  const meta = url ? await fetchLinkMeta(url) : { kind: "text", title: null, author: null, description: null, thumbnail: null };
  const db = getDb();
  const title = b.title?.trim() || meta.title || (url ? null : b.note!.trim().slice(0, 90));
  const matched = matchStories(db, [title, meta.description, b.note].filter(Boolean).join(" "));
  const insp = createInspiration(db, {
    url, kind: url ? detectKind(url) : "text", title, author: meta.author, description: meta.description, thumbnail: meta.thumbnail,
    note: b.note?.trim() || null, intents: b.intents ?? [], matchedClusters: matched,
  });
  return { ok: true, inspiration: insp, metadataFound: !!(meta.title || meta.description) };
});
