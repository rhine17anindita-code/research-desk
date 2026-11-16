import { getDb } from "@/lib/db";
import { buildDossier, dossierMarkdown } from "@/lib/research/dossier";

/** Download the project as a Markdown dossier. No AI. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const d = buildDossier(getDb(), id);
  if (!d) return new Response("Project not found", { status: 404 });
  const slug = d.project.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "dossier";
  return new Response(dossierMarkdown(d), {
    headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": `attachment; filename="${slug}.md"` },
  });
}
