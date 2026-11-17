import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { gather, getSolutionsBrief, keyTerms, lastRun, listExperts, saveExpert, type Scope } from "@/lib/experts";

export const maxDuration = 120;
const scopeOk = (s: string): s is Scope => ["cluster", "project", "topic"].includes(s);

/** The expert library for a story, project or topic (free). */
export const GET = route((req: Request) => {
  const u = new URL(req.url);
  const scope = u.searchParams.get("scope") ?? "";
  const ref = u.searchParams.get("ref") ?? "";
  if (!scopeOk(scope) || !ref) throw new Error("Which story, project or topic?");
  const db = getDb();
  return { ok: true, items: listExperts(db, scope, ref), run: lastRun(db, scope, ref), brief: getSolutionsBrief(db, scope, ref), terms: keyTerms(db, scope, ref) };
});

/** Gather (or refresh) the library from open sources — free. */
export const POST = route(async (req: Request) => {
  const b = await body<{ scope: string; ref: string; force?: boolean }>(req);
  if (!scopeOk(b.scope) || !b.ref?.trim()) throw new Error("Which story, project or topic?");
  return { ok: true, ...(await gather(getDb(), b.scope, b.scope === "topic" ? b.ref.trim().toLowerCase() : b.ref, { force: b.force })) };
});

/** Keep an item (for a project it becomes a source the script can cite). */
export const PATCH = route(async (req: Request) => {
  const b = await body<{ id: string; saved: boolean }>(req);
  saveExpert(getDb(), b.id, !!b.saved);
  return { ok: true };
});
