import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { addResearch, listResearch, viewResearch, type AddResearchInput } from "@/lib/research-inbox";

export const maxDuration = 60;

export const GET = route(() => {
  const db = getDb();
  return { ok: true, items: listResearch(db).map((r) => viewResearch(db, r)) };
});

/** Add to "My research": JSON {url|text|note,title} or a multipart form with a file. Free (no AI). */
export const POST = route(async (req: Request) => {
  let input: AddResearchInput;
  if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const fd = await req.formData();
    const f = fd.get("file");
    input = {
      note: (fd.get("note") as string) || undefined,
      title: (fd.get("title") as string) || undefined,
      file: f instanceof File && f.size ? { name: f.name, type: f.type, data: Buffer.from(await f.arrayBuffer()) } : undefined,
    };
  } else input = await body<AddResearchInput>(req);
  const db = getDb();
  return { ok: true, item: viewResearch(db, await addResearch(db, input)) };
});
