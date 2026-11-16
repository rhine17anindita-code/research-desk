import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { createLink, deleteLink, linksFor } from "@/lib/repo/links";
import type { ObjectType } from "@/lib/types";

export const GET = route((req: Request) => {
  const u = new URL(req.url);
  return { ok: true, links: linksFor(getDb(), u.searchParams.get("type") as ObjectType, u.searchParams.get("id") ?? "") };
});
export const POST = route(async (req: Request) => {
  const b = await body<{ fromType: ObjectType; fromId: string; toType: ObjectType; toId: string; relation: string; note?: string }>(req);
  if (!b.fromId || !b.toId || !b.relation) throw new Error("fromId, toId and relation are required");
  return { ok: true, link: createLink(getDb(), { ...b, origin: "user" }) };
});
export const DELETE = route(async (req: Request) => {
  const b = await body<{ id: string }>(req);
  deleteLink(getDb(), b.id);
  return { ok: true };
});
