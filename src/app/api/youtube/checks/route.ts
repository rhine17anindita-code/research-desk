import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { setCheck } from "@/lib/youtube";

export const POST = route(async (req: Request) => {
  const b = await body<{ scope: string; key: string; done: boolean }>(req);
  if (!/^(set|launch:[\w-]+|project:[\w-]+)$/.test(b.scope ?? "")) throw new Error("Bad checklist");
  setCheck(getDb(), b.scope, b.key, !!b.done);
  return { ok: true };
});
