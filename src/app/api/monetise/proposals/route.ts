import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { buildProposal, saveProposal, type ProposalInput } from "@/lib/monetise";

/** Build a proposal from templates (no AI). preview: true returns it without saving. */
export const POST = route(async (req: Request) => {
  const b = await body<ProposalInput & { preview?: boolean }>(req);
  if (!b.deliverables?.length) throw new Error("Add at least one deliverable");
  const db = getDb();
  return b.preview ? { ok: true, preview: buildProposal(db, b) } : { ok: true, proposal: saveProposal(db, b) };
});
