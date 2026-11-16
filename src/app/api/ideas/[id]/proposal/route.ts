import { getDb } from "@/lib/db";
import { body, route, type Ctx } from "@/lib/http";
import { writeProposal } from "@/lib/ideation/pitch";
import { getIdea } from "@/lib/ideation/repo";

export const maxDuration = 180;

export const POST = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  return writeProposal(getDb(), id, await body(req));
});

/** Download the proposal as Markdown. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const idea = getIdea(getDb(), id);
  if (!idea?.proposal) return new Response("No proposal yet", { status: 404 });
  const slug = idea.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50) || "proposal";
  return new Response(idea.proposal, { headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": `attachment; filename="${slug}-proposal.md"` } });
}
