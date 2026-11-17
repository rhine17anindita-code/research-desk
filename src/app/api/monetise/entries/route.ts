import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { addEntry, deleteEntry, updateEntry } from "@/lib/monetise";

type Kind = "item" | "sponsor" | "series" | "proposal";
const ok = (k: string): k is Kind => ["item", "sponsor", "series", "proposal"].includes(k);

/** Add, edit or remove anything in your monetisation library. */
export const POST = route(async (req: Request) => {
  const b = await body<{ kind: string; data: Record<string, unknown> }>(req);
  if (!ok(b.kind)) throw new Error("Unknown kind");
  return { ok: true, id: addEntry(getDb(), b.kind, b.data ?? {}) };
});
export const PATCH = route(async (req: Request) => {
  const b = await body<{ kind: string; id: string; data: Record<string, unknown> }>(req);
  if (!ok(b.kind)) throw new Error("Unknown kind");
  updateEntry(getDb(), b.kind, b.id, b.data ?? {});
  return { ok: true };
});
export const DELETE = route(async (req: Request) => {
  const b = await body<{ kind: string; id: string }>(req);
  if (!ok(b.kind)) throw new Error("Unknown kind");
  deleteEntry(getDb(), b.kind, b.id);
  return { ok: true };
});
