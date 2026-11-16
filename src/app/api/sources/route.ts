import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { linkQuestionSource, upsertSource, type SourceInput } from "@/lib/repo/sources";
import { addToProject } from "@/lib/repo/projects";
import { SOURCE_KINDS } from "@/lib/types";

/** Add a source by hand. Metadata is exactly what the user typed; nothing is fetched or inferred. */
export const POST = route(async (req: Request) => {
  const b = await body<Partial<SourceInput> & { questionId?: string; projectId?: string }>(req);
  if (!b.title?.trim()) throw new Error("A source needs a title");
  if (b.url && !/^https?:\/\//i.test(b.url)) throw new Error("URL must start with http:// or https://");
  const db = getDb();
  const source = upsertSource(db, {
    kind: SOURCE_KINDS.includes(b.kind as never) ? b.kind! : "other",
    title: b.title.trim(), authors: b.authors || null, publisher: b.publisher || null, publishedAt: b.publishedAt || null,
    url: b.url || null, doi: b.doi || null, excerpt: b.excerpt || null, notes: b.notes || null, provider: "user", saved: true,
  });
  if (b.questionId) linkQuestionSource(db, b.questionId, source.id, "attached", "added by you");
  if (b.projectId) addToProject(db, b.projectId, "source", source.id);
  return { ok: true, source };
});
