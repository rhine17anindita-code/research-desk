import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { writeSolutionsBrief, type Scope } from "@/lib/experts";

export const maxDuration = 180;

/** Optional AI: options with pros and cons, precedents and trade-offs, from the expert library. */
export const POST = route(async (req: Request) => {
  const b = await body<{ scope: Scope; ref: string; estimateOnly?: boolean }>(req);
  return writeSolutionsBrief(getDb(), b.scope, b.scope === "topic" ? b.ref.trim().toLowerCase() : b.ref, { estimateOnly: b.estimateOnly });
});
